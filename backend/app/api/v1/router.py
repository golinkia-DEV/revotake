from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    clients,
    tickets,
    products,
    meetings,
    agenda_hub,
    forms,
    ai,
    dashboard,
    store_types,
    stores,
    uploads,
    internal,
    notifications,
    scheduling_admin,
    scheduling_staff,
    scheduling_public,
    scheduling_checkout,
    scheduling_webhooks,
    flash_deals,
    public_explore,
    public_user,
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
            "/scheduling/flash-deals",
            "/public/scheduling",
            "/public/scheduling/{slug}/flash-deals",
            "/webhooks/scheduling",
            "/uploads",
        ],
    }


api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(store_types.router, prefix="/store-types", tags=["store-types"])
api_router.include_router(stores.router, prefix="/stores", tags=["stores"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(agenda_hub.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(forms.router, prefix="/forms", tags=["forms"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(internal.router, prefix="/internal", tags=["internal"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(scheduling_admin.router, prefix="/scheduling", tags=["scheduling"])
api_router.include_router(scheduling_staff.router, prefix="/scheduling", tags=["scheduling-staff"])
api_router.include_router(scheduling_public.router, prefix="/public/scheduling", tags=["scheduling-public"])
api_router.include_router(scheduling_checkout.router, prefix="/public/scheduling", tags=["scheduling-checkout"])
api_router.include_router(scheduling_webhooks.router, prefix="/webhooks/scheduling", tags=["webhooks-scheduling"])
api_router.include_router(flash_deals.router, prefix="/scheduling", tags=["flash-deals"])
api_router.include_router(public_explore.router, prefix="/public/explore", tags=["public-explore"])
api_router.include_router(public_user.router, prefix="/public/user", tags=["public-user"])
