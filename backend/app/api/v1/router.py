from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    clients,
    tickets,
    products,
    meetings,
    forms,
    ai,
    dashboard,
    store_types,
    stores,
    internal,
    scheduling_admin,
    scheduling_staff,
    scheduling_public,
    scheduling_webhooks,
)

api_router = APIRouter()


@api_router.get("/", tags=["meta"], summary="Información de la API v1")
async def api_v1_root():
    return {
        "service": "revotake-api",
        "version": "1.0.0",
        "prefix": "/api/v1",
        "resources": [
            "/auth",
            "/store-types",
            "/stores",
            "/clients",
            "/tickets",
            "/products",
            "/meetings",
            "/forms",
            "/ai",
            "/dashboard",
            "/internal",
            "/scheduling",
            "/public/scheduling",
            "/webhooks/scheduling",
        ],
    }


api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(store_types.router, prefix="/store-types", tags=["store-types"])
api_router.include_router(stores.router, prefix="/stores", tags=["stores"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(forms.router, prefix="/forms", tags=["forms"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(internal.router, prefix="/internal", tags=["internal"])
api_router.include_router(scheduling_admin.router, prefix="/scheduling", tags=["scheduling"])
api_router.include_router(scheduling_staff.router, prefix="/scheduling", tags=["scheduling-staff"])
api_router.include_router(scheduling_public.router, prefix="/public/scheduling", tags=["scheduling-public"])
api_router.include_router(scheduling_webhooks.router, prefix="/webhooks/scheduling", tags=["webhooks-scheduling"])
