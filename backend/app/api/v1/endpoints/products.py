from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.product import Product, ProductBranchStock
from app.models.purchase import Purchase
from app.models.client import Client
from app.models.scheduling import Branch
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
    stock: int = 0
    lead_time_days: int = 3
    category: Optional[str] = None
    custom_fields: dict = {}
    branch_stocks: Optional[list[BranchStockIn]] = None


class SaleCreate(BaseModel):
    client_id: str
    product_id: str
    quantity: int
    unit_price: float
    branch_id: Optional[str] = None


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
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
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
    ctx: StoreContext = Depends(require_store),
):
    """Sedes activas de la tienda para configurar inventario (sin requerir permisos de agenda)."""
    branches = await _store_branches(db, ctx.store_id)
    return {"items": [{"id": b.id, "name": b.name} for b in branches]}


@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store),
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
    ctx: StoreContext = Depends(require_store),
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
    ctx: StoreContext = Depends(require_store),
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
    ctx: StoreContext = Depends(require_store),
):
    body = data.model_dump(exclude={"branch_stocks"})
    product = Product(store_id=ctx.store_id, **body)
    db.add(product)
    await db.flush()
    await _set_product_branch_stocks(db, product, ctx.store_id, data.branch_stocks, data.stock)
    await recalculate_stock_status(product, db)
    return {"id": product.id, "name": product.name}


@router.put("/{product_id}")
async def update_product(
    product_id: str,
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store),
):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404)
    body = data.model_dump(exclude={"branch_stocks"})
    for k, v in body.items():
        setattr(product, k, v)
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
    return {"id": product.id}


@router.get("/branch-report")
async def branch_stock_report(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    ctx: StoreContext = Depends(require_store),
):
    """Stock total y ventas últimos 30 días agrupados por sede."""
    branches = await _store_branches(db, ctx.store_id)
    if not branches:
        return {"branches": []}

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

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
    ctx: StoreContext = Depends(require_store),
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

    n_pbs = await db.scalar(
        select(func.count()).select_from(ProductBranchStock).where(ProductBranchStock.product_id == product.id)
    )
    if (n_pbs or 0) > 0:
        if not data.branch_id:
            raise HTTPException(400, "Indicá la sede (branch_id) para descontar el stock.")
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
        quantity=data.quantity,
        unit_price=data.unit_price,
        total=data.quantity * data.unit_price,
    )
    db.add(purchase)
    await recalculate_stock_status(product, db)
    return {"message": "Sale recorded", "stock_status": product.stock_status}
