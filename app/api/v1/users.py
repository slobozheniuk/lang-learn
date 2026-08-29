from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.crud.language import get_language_by_code
from app.crud.user import (
    get_user_by_username,
    update_user,
)
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserRead, summary="Get current logged in user profile")
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead, summary="Update current user profile/settings")
@router.put("/me", response_model=UserRead, summary="Update current user profile/settings")
def update_me(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    native_lang = user_in.native_language or user_in.default_source_lang
    if native_lang:
        if not get_language_by_code(db, native_lang.lower().strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid native language '{native_lang}'.",
            )
    target_lang = user_in.target_language or user_in.default_target_lang
    if target_lang:
        if not get_language_by_code(db, target_lang.lower().strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target language '{target_lang}'.",
            )

    if user_in.username and user_in.username.strip() != current_user.username:
        existing = get_user_by_username(db, user_in.username)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists.",
            )

    updated = update_user(db, current_user, user_in)
    return UserRead.model_validate(updated)
