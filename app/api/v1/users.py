"""User profile endpoints.

The canonical "me" endpoints (GET/PATCH /me) live under /auth. This router is
kept as a thin alias for backwards compatibility of the /users prefix.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1._shared import update_current_user
from app.auth.dependencies import get_current_user
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
    return update_current_user(db, current_user, user_in)
