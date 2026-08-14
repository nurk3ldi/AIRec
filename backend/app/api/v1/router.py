from fastapi import APIRouter

from app.api.v1 import appointments, auth, business

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(appointments.router)
