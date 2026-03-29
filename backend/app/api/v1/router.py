from fastapi import APIRouter
from app.api.v1.endpoints import auth, clients, tickets, products, meetings, forms, ai, dashboard, store_types, stores

api_router = APIRouter()
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
