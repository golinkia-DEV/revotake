from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.deps import StoreContext, require_store
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.client import Client
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    price: float = 0
    stock: int = 0
    lead_time_days: int = 3
    category: Optional[str] = None
    custom_fields: dict = {}

class SaleCreate(BaseModel):
    client_id: str
    product_id: str
    quantity: int
    unit_price: float

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
            Purchase.sold_at >= thirty_days_ago
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

@router.get("/")
async def list_products(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Product).where(Product.store_id == ctx.store_id).order_by(Product.name))
    products = result.scalars().all()
    return {"items": [{"id": p.id, "name": p.name, "sku": p.sku, "price": p.price, "stock": p.stock, "stock_status": p.stock_status, "avg_daily_sales": p.avg_daily_sales, "days_of_stock": p.days_of_stock, "category": p.category} for p in products]}

@router.get("/alerts")
async def stock_alerts(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Product).where(Product.store_id == ctx.store_id, Product.stock_status.in_(["low", "critical"])))
    products = result.scalars().all()
    return {"alerts": [{"id": p.id, "name": p.name, "stock": p.stock, "stock_status": p.stock_status, "days_of_stock": p.days_of_stock, "avg_daily_sales": p.avg_daily_sales} for p in products]}


@router.get("/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "sku": product.sku,
        "price": product.price,
        "stock": product.stock,
        "lead_time_days": product.lead_time_days,
        "category": product.category,
        "custom_fields": product.custom_fields,
        "stock_status": product.stock_status,
        "avg_daily_sales": product.avg_daily_sales,
        "days_of_stock": product.days_of_stock,
    }


@router.post("/")
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    product = Product(store_id=ctx.store_id, **data.model_dump())
    db.add(product)
    await db.flush()
    await recalculate_stock_status(product, db)
    return {"id": product.id, "name": product.name}

@router.put("/{product_id}")
async def update_product(product_id: str, data: ProductCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    result = await db.execute(select(Product).where(Product.id == product_id, Product.store_id == ctx.store_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(product, k, v)
    await recalculate_stock_status(product, db)
    return {"id": product.id}

@router.post("/sales")
async def record_sale(data: SaleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ctx: StoreContext = Depends(require_store)):
    product_result = await db.execute(select(Product).where(Product.id == data.product_id, Product.store_id == ctx.store_id))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    cr = await db.execute(select(Client.id).where(Client.id == data.client_id, Client.store_id == ctx.store_id))
    if cr.scalar_one_or_none() is None:
        raise HTTPException(400, "Cliente no pertenece a esta tienda")
    if product.stock < data.quantity:
        raise HTTPException(400, "Insufficient stock")
    product.stock -= data.quantity
    purchase = Purchase(
        store_id=ctx.store_id,
        client_id=data.client_id,
        product_id=data.product_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        total=data.quantity * data.unit_price,
    )
    db.add(purchase)
    await recalculate_stock_status(product, db)
    return {"message": "Sale recorded", "stock_status": product.stock_status}
