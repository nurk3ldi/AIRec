from fastapi import APIRouter

from app.api.v1 import appointments, auth, business, conversations

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(appointments.router)
api_router.include_router(conversations.router)
