from datetime import datetime, timedelta, date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.deps import StoreContext, ensure_branch_in_scope, require_store_permission
from app.core.permissions import EXPORTAR_REGISTROS, REGISTRAR_VENTAS, VER_REPORTES
from app.models.product import Product, ProductBranchStock, ProductCostHistory
from app.models.purchase import Purchase
from app.models.client import Client
from app.models.scheduling import Branch
from app.models.supplier import Supplier, ProductSupplier, QuotationRequest
from app.services.mail import mail_configured, send_html_email
from app.models.user import User

router = APIRouter()


class BranchStockIn(BaseModel):
    branch_id: str
    quantity: int = Field(ge=0)
    lead_time_days: Optional[int] = Field(None, ge=0, le=365)


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    price: float = 0
    cost_price: float = 0
    stock: int = 0
    lead_time_days: int = 3
    category: Optional[str] = None
    image_urls: Optional[list[str]] = None
    custom_fields: dict = {}
    branch_stocks: Optional[list[BranchStockIn]] = None


class SaleCreate(BaseModel):
    client_id: str
    product_id: str
    quantity: int
    unit_price: float
    branch_id: Optional[str] = None
    supplier_id: Optional[str] = None


class SupplierCreate(BaseModel):
    name: str
    legal_name: Optional[str] = None
    rut: Optional[str] = None
    contact_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class ProductSuppliersBody(BaseModel):
    supplier_ids: list[str] = Field(default_factory=list)


class QuotationCreate(BaseModel):
    product_ids: list[str]


async def _sync_product_stock_from_branches(db: AsyncSession, product: Product) -> None:
    r = await db.execute(
        select(func.count()).select_from(ProductBranchStock).where(ProductBranchStock.product_id == product.id)
    )
    if (r.scalar() or 0) == 0:
        return
    r2 = await db.execute(
        select(func.coalesce(func.sum(ProductBranchStock.quantity), 0)).where(ProductBranchStock.product_id == product.id)
    )
    product.stock = int(r2.scalar() or 0)


async def _store_branches(db: AsyncSession, store_id: str) -> list[Branch]:
    br = await db.execute(
        select(Branch).where(Branch.store_id == store_id, Branch.is_active.is_(True)).order_by(Branch.created_at)
    )
    return list(br.scalars().all())


async def _set_product_branch_stocks(
    db: AsyncSession,
    product: Product,
    store_id: str,
    branch_items: Optional[list[BranchStockIn]],
    legacy_stock: int,
) -> None:
    branches = await _store_branches(db, store_id)
    if not branches:
        product.stock = max(0, int(legacy_stock))
        return

    by_bid = {x.branch_id: x for x in (branch_items or [])}
    if branch_items is not None:
        for b in branches:
            bi = by_bid.get(b.id)
            if bi:
                db.add(
                    ProductBranchStock(
                        product_id=product.id,
                        branch_id=b.id,
                        quantity=bi.quantity,
                        lead_time_days=bi.lead_time_days,
                    )
                )
            else:
                db.add(ProductBranchStock(product_id=product.id, branch_id=b.id, quantity=0, lead_time_days=None))
    else:
        q0 = max(0, int(legacy_stock))
        for i, b in enumerate(branches):
            q = q0 if i == 0 else 0
            db.add(ProductBranchStock(product_id=product.id, branch_id=b.id, quantity=q, lead_time_days=None))
    await db.flush()
    await _sync_product_stock_from_branches(db, product)


async def _branch_stocks_payload(
    db: AsyncSession,
    store_id: str,
    product_ids: list[str],
) -> dict[str, list[dict]]:
    if not product_ids:
        return {}
    branches = await _store_branches(db, store_id)
    pbs_r = await db.execute(select(ProductBranchStock).where(ProductBranchStock.product_id.in_(product_ids)))
    pbs_rows = list(pbs_r.scalars().all())
    by_product: dict[str, dict[str, ProductBranchStock]] = {}
    for row in pbs_rows:
        by_product.setdefault(row.product_id, {})[row.branch_id] = row
    out: dict[str, list[dict]] = {}
    for pid in product_ids:
        m = by_product.get(pid, {})
        out[pid] = [
            {
                "branch_id": b.id,
                "branch_name": b.name,
                "quantity": m[b.id].quantity if b.id in m else 0,
                "lead_time_days": m[b.id].lead_time_days if b.id in m else None,
            }
            for b in branches
        ]
    return out


async def recalculate_stock_status(product: Product, db: AsyncSession):
    if product.stock <= 0:
        product.avg_daily_sales = product.avg_daily_sales or 0
        product.days_of_stock = 0.0
        product.stock_status = "critical"
        return
    thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    result = await db.execute(
        select(func.sum(Purchase.quantity)).where(
            Purchase.product_id == product.id,
            Purchase.sold_at >= thirty_days_ago,
        )
    )
    total_sold = result.scalar() or 0
    avg_daily = total_sold / 30.0
    product.avg_daily_sales = avg_daily
    if avg_daily > 0:
        product.days_of_stock = product.stock / avg_daily
        if product.days_of_stock <= product.lead_time_days:
            product.stock_status = "critical"
        elif product.days_of_stock <= product.lead_time_days * 2:
            product.stock_status = "low"
        else:
            product.stock_status = "ok"
    else:
        product.days_of_stock = None
        product.stock_status = "ok"


@router.get("/branch-context")
async def list_branches_for_stock(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    """Sedes activas de la tienda para configurar inventario (sin requerir permisos de agenda)."""
    branches = await _store_branches(db, ctx.store_id)
    return {"items": [{"id": b.id, "name": b.name} for b in branches]}


@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    result = await db.execute(select(Product).where(Product.store_id == ctx.store_id).order_by(Product.name))
    products = result.scalars().all()
    ids = [p.id for p in products]
    payload = await _branch_stocks_payload(db, ctx.store_id, ids)
    return {
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "price": p.price,
                "cost_price": p.cost_price,
                "image_urls": (p.image_urls or [])[:3],
                "stock": p.stock,
                "branch_stocks": payload.get(p.id, []),
                "stock_status": p.stock_status,
                "avg_daily_sales": p.avg_daily_sales,
                "days_of_stock": p.days_of_stock,
                "category": p.category,
                "lead_time_days": p.lead_time_days,
            }
            for p in products
        ]
    }


@router.get("/alerts")
async def stock_alerts(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES)),
):
    result = await db.execute(
        select(Product).where(Product.store_id == ctx.store_id, Product.stock_status.in_(["low", "critical"]))
    )
    products = result.scalars().all()
    ids = [p.id for p in products]
    payload = await _branch_stocks_payload(db, ctx.store_id, ids)
    return {
        "alerts": [
            {
                "id": p.id,
                "name": p.name,
                "stock": p.stock,
                "branch_stocks": payload.get(p.id, []),
                "stock_status": p.stock_status,
                "days_of_stock": p.days_of_stock,
                "avg_daily_sales": p.avg_daily_sales,
            }
            for p in products
        ]
    }


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    payload = await _branch_stocks_payload(db, ctx.store_id, [product.id])
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "sku": product.sku,
        "price": product.price,
        "cost_price": product.cost_price,
        "image_urls": (product.image_urls or [])[:3],
        "stock": product.stock,
        "branch_stocks": payload.get(product.id, []),
        "lead_time_days": product.lead_time_days,
        "category": product.category,
        "custom_fields": product.custom_fields,
        "stock_status": product.stock_status,
        "avg_daily_sales": product.avg_daily_sales,
        "days_of_stock": product.days_of_stock,
    }


@router.post("/")
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    body = data.model_dump(exclude={"branch_stocks"})
    product = Product(store_id=ctx.store_id, **body)
    if isinstance(product.image_urls, list):
        product.image_urls = list(product.image_urls)[:3]
    db.add(product)
    await db.flush()
    db.add(ProductCostHistory(product_id=product.id, cost_price=float(product.cost_price or 0)))
    await _set_product_branch_stocks(db, product, ctx.store_id, data.branch_stocks, data.stock)
    await recalculate_stock_status(product, db)
    return {"id": product.id, "name": product.name}


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404)
    body = data.model_dump(exclude={"branch_stocks"})
    prev_cost = float(product.cost_price or 0)
    for k, v in body.items():
        setattr(product, k, v)
    if isinstance(product.image_urls, list):
        product.image_urls = list(product.image_urls)[:3]
    branch_items = data.branch_stocks
    if branch_items is None:
        ex = await db.execute(select(ProductBranchStock).where(ProductBranchStock.product_id == product.id))
        rows = list(ex.scalars().all())
        if rows:
            branch_items = [
                BranchStockIn(branch_id=r.branch_id, quantity=r.quantity, lead_time_days=r.lead_time_days)
                for r in rows
            ]
    await db.execute(delete(ProductBranchStock).where(ProductBranchStock.product_id == product.id))
    await db.flush()
    await _set_product_branch_stocks(db, product, ctx.store_id, branch_items, data.stock)
    await recalculate_stock_status(product, db)
    if float(product.cost_price or 0) != prev_cost:
        db.add(ProductCostHistory(product_id=product.id, cost_price=float(product.cost_price or 0)))
    return {"id": product.id}


@router.get("/{product_id}/cost-history")
async def get_product_cost_history(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    product = (await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    rows = (
        await db.execute(
            select(ProductCostHistory)
            .where(ProductCostHistory.product_id == product_id)
            .order_by(ProductCostHistory.changed_at.desc())
            .limit(100)
        )
    ).scalars().all()
    return {"items": [{"cost_price": r.cost_price, "changed_at": r.changed_at.isoformat()} for r in rows]}


@router.get("/branch-report")
async def branch_stock_report(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(EXPORTAR_REGISTROS, VER_REPORTES)),
):
    """Stock total y ventas últimos 30 días agrupados por sede."""
    branches = await _store_branches(db, ctx.store_id)
    if not branches:
        return {"branches": []}

    thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)

    # Stock por sede: sum quantities
    pbs_r = await db.execute(
        select(ProductBranchStock.branch_id, func.sum(ProductBranchStock.quantity).label("total_units"))
        .join(Product, Product.id == ProductBranchStock.product_id)
        .where(Product.store_id == ctx.store_id)
        .group_by(ProductBranchStock.branch_id)
    )
    stock_by_branch = {row.branch_id: int(row.total_units or 0) for row in pbs_r.all()}

    # Valor de inventario por sede: sum(quantity * price)
    val_r = await db.execute(
        select(
            ProductBranchStock.branch_id,
            func.sum(ProductBranchStock.quantity * Product.price).label("value"),
        )
        .join(Product, Product.id == ProductBranchStock.product_id)
        .where(Product.store_id == ctx.store_id)
        .group_by(ProductBranchStock.branch_id)
    )
    value_by_branch = {row.branch_id: float(row.value or 0) for row in val_r.all()}

    # Ventas 30d por sede: count ventas y revenue
    sales_r = await db.execute(
        select(
            Purchase.branch_id,
            func.count(Purchase.id).label("sales_count"),
            func.sum(Purchase.total).label("revenue"),
        )
        .where(Purchase.store_id == ctx.store_id, Purchase.sold_at >= thirty_days_ago)
        .group_by(Purchase.branch_id)
    )
    sales_by_branch: dict[str, dict] = {}
    for row in sales_r.all():
        sales_by_branch[row.branch_id or "__none__"] = {
            "sales_count": int(row.sales_count or 0),
            "revenue_30d": float(row.revenue or 0),
        }

    # Productos con stock crítico por sede
    crit_r = await db.execute(
        select(ProductBranchStock.branch_id, func.count(Product.id).label("critical_count"))
        .join(Product, Product.id == ProductBranchStock.product_id)
        .where(Product.store_id == ctx.store_id, Product.stock_status == "critical")
        .group_by(ProductBranchStock.branch_id)
    )
    crit_by_branch = {row.branch_id: int(row.critical_count or 0) for row in crit_r.all()}

    out = []
    for b in branches:
        s = sales_by_branch.get(b.id, {"sales_count": 0, "revenue_30d": 0.0})
        out.append({
            "branch_id": b.id,
            "branch_name": b.name,
            "region": b.region,
            "comuna": b.comuna,
            "total_units": stock_by_branch.get(b.id, 0),
            "inventory_value": value_by_branch.get(b.id, 0.0),
            "sales_count_30d": s["sales_count"],
            "revenue_30d": s["revenue_30d"],
            "critical_products": crit_by_branch.get(b.id, 0),
        })

    return {"branches": out, "period_days": 30}


@router.post("/sales")
async def record_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    product_result = await db.execute(
        select(Product).where(Product.id == data.product_id, Product.store_id == ctx.store_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    cr = await db.execute(select(Client.id).where(Client.id == data.client_id, Client.store_id == ctx.store_id))
    if cr.scalar_one_or_none() is None:
        raise HTTPException(400, "Cliente no pertenece a esta tienda")
    if data.supplier_id:
        sr = await db.execute(select(Supplier.id).where(Supplier.id == data.supplier_id, Supplier.store_id == ctx.store_id))
        if sr.scalar_one_or_none() is None:
            raise HTTPException(400, "Proveedor no pertenece a esta tienda")

    n_pbs = await db.scalar(
        select(func.count()).select_from(ProductBranchStock).where(ProductBranchStock.product_id == product.id)
    )
    if (n_pbs or 0) > 0:
        if not data.branch_id:
            raise HTTPException(400, "Indicá la sede (branch_id) para descontar el stock.")
        ensure_branch_in_scope(ctx, data.branch_id)
        br_ok = await db.execute(
            select(Branch.id).where(Branch.id == data.branch_id, Branch.store_id == ctx.store_id, Branch.is_active.is_(True))
        )
        if br_ok.scalar_one_or_none() is None:
            raise HTTPException(400, "Sede inválida o inactiva")
        row = await db.execute(
            select(ProductBranchStock).where(
                ProductBranchStock.product_id == product.id,
                ProductBranchStock.branch_id == data.branch_id,
            )
        )
        pbs = row.scalar_one_or_none()
        if not pbs:
            raise HTTPException(400, "No hay stock configurado para este producto en la sede indicada")
        if pbs.quantity < data.quantity:
            raise HTTPException(400, "Insufficient stock")
        pbs.quantity -= data.quantity
        await _sync_product_stock_from_branches(db, product)
    else:
        if product.stock < data.quantity:
            raise HTTPException(400, "Insufficient stock")
        product.stock -= data.quantity

    purchase = Purchase(
        store_id=ctx.store_id,
        client_id=data.client_id,
        product_id=data.product_id,
        branch_id=data.branch_id if (n_pbs or 0) > 0 else None,
        supplier_id=data.supplier_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        total=data.quantity * data.unit_price,
    )
    db.add(purchase)
    await recalculate_stock_status(product, db)
    return {"message": "Sale recorded", "stock_status": product.stock_status}


@router.get("/suppliers")
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    rows = (await db.execute(select(Supplier).where(Supplier.store_id == ctx.store_id).order_by(Supplier.name))).scalars().all()
    return {
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "legal_name": s.legal_name,
                "rut": s.rut,
                "contact_name": s.contact_name,
                "email": s.email,
                "phone": s.phone,
                "address": s.address,
                "region": s.region,
                "city": s.city,
                "website": s.website,
                "payment_terms": s.payment_terms,
                "notes": s.notes,
                "is_active": s.is_active,
            }
            for s in rows
        ]
    }


@router.post("/suppliers")
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    s = Supplier(
        store_id=ctx.store_id,
        name=data.name.strip(),
        legal_name=(data.legal_name or "").strip() or None,
        rut=(data.rut or "").strip() or None,
        contact_name=(data.contact_name or "").strip() or None,
        email=data.email.strip().lower(),
        phone=(data.phone or "").strip() or None,
        address=(data.address or "").strip() or None,
        region=(data.region or "").strip() or None,
        city=(data.city or "").strip() or None,
        website=(data.website or "").strip() or None,
        payment_terms=(data.payment_terms or "").strip() or None,
        notes=(data.notes or "").strip() or None,
        is_active=bool(data.is_active),
    )
    db.add(s)
    await db.flush()
    return {"id": s.id}


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    s = (await db.execute(select(Supplier).where(Supplier.id == supplier_id, Supplier.store_id == ctx.store_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Supplier not found")
    s.name = data.name.strip()
    s.legal_name = (data.legal_name or "").strip() or None
    s.rut = (data.rut or "").strip() or None
    s.contact_name = (data.contact_name or "").strip() or None
    s.email = data.email.strip().lower()
    s.phone = (data.phone or "").strip() or None
    s.address = (data.address or "").strip() or None
    s.region = (data.region or "").strip() or None
    s.city = (data.city or "").strip() or None
    s.website = (data.website or "").strip() or None
    s.payment_terms = (data.payment_terms or "").strip() or None
    s.notes = (data.notes or "").strip() or None
    s.is_active = bool(data.is_active)
    return {"ok": True}


@router.get("/{product_id}/suppliers")
async def list_product_suppliers(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    product = (await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    rows = (
        await db.execute(
            select(Supplier).join(ProductSupplier, ProductSupplier.supplier_id == Supplier.id).where(ProductSupplier.product_id == product_id)
        )
    ).scalars().all()
    return {"items": [{"id": s.id, "name": s.name, "email": s.email, "phone": s.phone} for s in rows]}


@router.put("/{product_id}/suppliers")
async def set_product_suppliers(
    product_id: str,
    data: ProductSuppliersBody,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    product = (await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    await db.execute(delete(ProductSupplier).where(ProductSupplier.product_id == product_id))
    if data.supplier_ids:
        sup_rows = (
            await db.execute(select(Supplier.id).where(Supplier.store_id == ctx.store_id, Supplier.id.in_(data.supplier_ids)))
        ).scalars().all()
        for sid in sup_rows:
            db.add(ProductSupplier(product_id=product_id, supplier_id=sid))
    return {"ok": True}


@router.post("/quotes")
async def create_quotation_requests(
    data: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(REGISTRAR_VENTAS)),
):
    if not data.product_ids:
        raise HTTPException(400, "Selecciona productos")
    rows = (
        await db.execute(
            select(Product, Supplier)
            .join(ProductSupplier, ProductSupplier.product_id == Product.id)
            .join(Supplier, Supplier.id == ProductSupplier.supplier_id)
            .where(Product.store_id == ctx.store_id, Product.id.in_(data.product_ids))
        )
    ).all()
    by_supplier: dict[str, dict] = {}
    for product, supplier in rows:
        bucket = by_supplier.setdefault(supplier.id, {"supplier": supplier, "products": []})
        bucket["products"].append(product)
    sent = 0
    for sid, payload in by_supplier.items():
        supplier: Supplier = payload["supplier"]
        products = payload["products"]
        items_html = "".join(f"<li>{p.name} · stock actual {p.stock}</li>" for p in products)
        html = (
            f"<p>Hola {supplier.name},</p>"
            "<p>Solicitamos cotización de los siguientes productos:</p>"
            f"<ul>{items_html}</ul>"
            "<p>Gracias.</p>"
        )
        if mail_configured():
            send_html_email(supplier.email, "Solicitud de cotización", html)
        db.add(QuotationRequest(store_id=ctx.store_id, supplier_id=sid, payload={"product_ids": [p.id for p in products]}, email_to=supplier.email, email_cc=user.email))
        sent += 1
    return {"ok": True, "sent_requests": sent}


@router.get("/suppliers/report")
async def suppliers_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store_permission(VER_REPORTES, REGISTRAR_VENTAS)),
):
    end_d = to_date or date.today()
    start_d = from_date or (end_d - timedelta(days=30))
    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day) + timedelta(days=1)

    totals = await db.execute(
        select(
            Supplier.id,
            Supplier.name,
            func.count(Purchase.id),
            func.coalesce(func.sum(Purchase.total), 0.0),
            func.coalesce(func.sum(Purchase.quantity), 0),
        )
        .join(Purchase, Purchase.supplier_id == Supplier.id)
        .where(
            Supplier.store_id == ctx.store_id,
            Purchase.store_id == ctx.store_id,
            Purchase.sold_at >= start_dt,
            Purchase.sold_at < end_dt,
        )
        .group_by(Supplier.id, Supplier.name)
        .order_by(func.coalesce(func.sum(Purchase.total), 0.0).desc())
    )
    by_supplier = [
        {
            "supplier_id": sid,
            "supplier_name": sname,
            "purchases_count": int(cnt or 0),
            "amount_total": float(total or 0),
            "units_total": int(units or 0),
        }
        for sid, sname, cnt, total, units in totals.all()
    ]

    timeline_rows = await db.execute(
        select(
            func.date(Purchase.sold_at).label("day"),
            Supplier.name,
            func.coalesce(func.sum(Purchase.total), 0.0),
        )
        .join(Supplier, Supplier.id == Purchase.supplier_id)
        .where(
            Purchase.store_id == ctx.store_id,
            Purchase.sold_at >= start_dt,
            Purchase.sold_at < end_dt,
        )
        .group_by(func.date(Purchase.sold_at), Supplier.name)
        .order_by(func.date(Purchase.sold_at))
    )
    timeline: dict[str, dict[str, float]] = {}
    supplier_names = sorted({item["supplier_name"] for item in by_supplier})
    for day, supplier_name, total in timeline_rows.all():
        dkey = str(day)
        row = timeline.setdefault(dkey, {"date": dkey})
        row[supplier_name] = float(total or 0)
    timeline_items = list(timeline.values())

    top_products_rows = await db.execute(
        select(
            Supplier.name,
            Product.name,
            func.coalesce(func.sum(Purchase.quantity), 0),
            func.coalesce(func.sum(Purchase.total), 0.0),
        )
        .join(Supplier, Supplier.id == Purchase.supplier_id)
        .join(Product, Product.id == Purchase.product_id)
        .where(
            Purchase.store_id == ctx.store_id,
            Purchase.sold_at >= start_dt,
            Purchase.sold_at < end_dt,
        )
        .group_by(Supplier.name, Product.name)
        .order_by(func.coalesce(func.sum(Purchase.total), 0.0).desc())
        .limit(20)
    )
    top_products = [
        {
            "supplier_name": sname,
            "product_name": pname,
            "units_total": int(units or 0),
            "amount_total": float(total or 0),
        }
        for sname, pname, units, total in top_products_rows.all()
    ]
    return {
        "summary": {
            "from_date": start_d.isoformat(),
            "to_date": end_d.isoformat(),
            "suppliers_with_purchases": len(by_supplier),
            "purchases_count": sum(x["purchases_count"] for x in by_supplier),
            "amount_total": sum(x["amount_total"] for x in by_supplier),
        },
        "by_supplier": by_supplier,
        "timeline": timeline_items,
        "timeline_keys": supplier_names,
        "top_products": top_products,
    }
