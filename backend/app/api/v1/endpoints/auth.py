from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token
from app.core.permissions import effective_permissions
from app.models.user import User, UserRole
from app.models.store import StoreMember
from app.core.config import settings

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: UserRole = UserRole.SELLER

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User inactive")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User inactive")
    token = create_access_token(
        {
            "sub": user.id,
            "role": user.role.value,
            "global_role": user.role.value,
        }
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "global_role": user.role.value,
        },
    }

@router.post("/register")
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    if not settings.ALLOW_OPEN_REGISTRATION:
        raise HTTPException(status_code=403, detail="Open registration is disabled")
    if data.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="El rol administrador global solo lo asigna otro administrador")
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=data.email, name=data.name, hashed_password=get_password_hash(data.password), role=data.role)
    db.add(user)
    return {"message": "User created", "id": user.id}


@router.get("/me")
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_store_id: str | None = Header(None, alias="X-Store-Id"),
):
    """Con header X-Store-Id devuelve rol en tienda y lista de permisos efectivos (AgendaPro-style)."""
    out = {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "global_role": current_user.role.value,
    }
    if x_store_id:
        r = await db.execute(
            select(StoreMember).where(
                StoreMember.user_id == current_user.id,
                StoreMember.store_id == x_store_id,
            )
        )
        m = r.scalar_one_or_none()
        if m:
            perms = sorted(effective_permissions(m))
            out["store_context"] = {
                "store_id": x_store_id,
                "member_role": m.role.value,
                "permissions": perms,
            }
        else:
            out["store_context"] = None
    return out
