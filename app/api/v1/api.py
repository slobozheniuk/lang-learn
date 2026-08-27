from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.languages import router as languages_router
from app.api.v1.review import router as review_router
from app.api.v1.words import router as words_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(languages_router, prefix="/languages", tags=["languages"])
api_router.include_router(words_router, prefix="/words", tags=["words"])
api_router.include_router(review_router, prefix="/review", tags=["review"])
