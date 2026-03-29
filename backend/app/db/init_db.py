import asyncio
from app.core.database import engine, Base
from app.models import User, UserRole, StoreType, Store, StoreMember
from app.models.store import StoreMemberRole
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

DEFAULT_SETTINGS = {
    "ai": {"business_context": "", "tone": "professional"},
    "stock": {"replenishment_buffer_days": 2},
    "agenda": {"default_duration_minutes": 30},
}

STORE_TYPE_SEEDS = [
    {
        "name": "Comercio minorista",
        "slug": "retail",
        "description": "Tienda física u online con catálogo y stock.",
        "icon": "shopping-bag",
        "default_settings": {**DEFAULT_SETTINGS, "ai": {**DEFAULT_SETTINGS["ai"], "business_context": "Venta de productos con inventario y posible envío."}},
    },
    {
        "name": "Servicios y consultoría",
        "slug": "services",
        "description": "Citas, proyectos y seguimiento de clientes B2B.",
        "icon": "briefcase",
        "default_settings": {**DEFAULT_SETTINGS, "ai": {**DEFAULT_SETTINGS["ai"], "business_context": "Prestación de servicios, propuestas y reuniones con clientes."}},
    },
    {
        "name": "Salud y belleza",
        "slug": "beauty",
        "description": "Agenda de citas, fichas de clientes y consumibles.",
        "icon": "sparkles",
        "default_settings": {**DEFAULT_SETTINGS, "agenda": {"default_duration_minutes": 45}, "ai": {**DEFAULT_SETTINGS["ai"], "business_context": "Salón, clínica estética o spa: citas, historial y productos de uso frecuente."}},
    },
    {
        "name": "Restaurante / delivery",
        "slug": "food",
        "description": "Pedidos, incidencias y relación con clientes.",
        "icon": "utensils",
        "default_settings": {**DEFAULT_SETTINGS, "ai": {**DEFAULT_SETTINGS["ai"], "business_context": "Restaurante u operación de comida: pedidos, reservas y reclamos."}},
    },
    {
        "name": "Genérico",
        "slug": "generic",
        "description": "Plantilla neutra adaptable a cualquier negocio.",
        "icon": "layout-grid",
        "default_settings": DEFAULT_SETTINGS,
    },
]

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        for spec in STORE_TYPE_SEEDS:
            r = await session.execute(select(StoreType).where(StoreType.slug == spec["slug"]))
            if r.scalar_one_or_none() is None:
                session.add(
                    StoreType(
                        name=spec["name"],
                        slug=spec["slug"],
                        description=spec["description"],
                        icon=spec["icon"],
                        default_settings=spec["default_settings"],
                    )
                )
        await session.commit()

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "admin@revotake.com"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email="admin@revotake.com",
                name="Admin RevoTake",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print("Admin user created: admin@revotake.com / admin123")
        tr = await session.execute(select(StoreType).where(StoreType.slug == "generic"))
        st = tr.scalar_one_or_none()
        if not st:
            print("No generic store type; run seeds first")
            return
        sr = await session.execute(select(Store).where(Store.slug == "mi-tienda-demo"))
        store = sr.scalar_one_or_none()
        if not store:
            store = Store(
                name="Mi tienda (demo)",
                slug="mi-tienda-demo",
                store_type_id=st.id,
                settings=dict(st.default_settings or {}),
            )
            session.add(store)
            await session.commit()
            await session.refresh(store)
            print("Demo store created:", store.id)
        mr = await session.execute(
            select(StoreMember).where(StoreMember.user_id == user.id, StoreMember.store_id == store.id)
        )
        if mr.scalar_one_or_none() is None:
            session.add(StoreMember(user_id=user.id, store_id=store.id, role=StoreMemberRole.ADMIN))
            await session.commit()
            print("Admin linked to demo store")

if __name__ == "__main__":
    asyncio.run(init_db())
