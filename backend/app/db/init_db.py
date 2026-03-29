import asyncio
from app.core.database import engine, Base
from app.models import User, Client, Ticket, Product, Purchase, FormLink, Meeting
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == "admin@revotake.com"))
        existing = result.scalar_one_or_none()
        if not existing:
            admin = User(email="admin@revotake.com", name="Admin RevoTake", hashed_password=get_password_hash("admin123"), role="admin")
            session.add(admin)
            await session.commit()
            print("Admin user created: admin@revotake.com / admin123")

if __name__ == "__main__":
    asyncio.run(init_db())
