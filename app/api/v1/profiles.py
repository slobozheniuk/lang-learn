import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.schemas.profile import LearningProfileCreate, LearningProfileRead

logger = logging.getLogger("app.profiles")
router = APIRouter()


@router.get("/", response_model=list[LearningProfileRead], summary="List all learning profiles for current user")
def list_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LearningProfileRead]:
    profiles = db.scalars(
        select(LearningProfile).where(LearningProfile.user_id == current_user.id)
    ).all()
    return [LearningProfileRead.model_validate(p) for p in profiles]


@router.post("/", response_model=LearningProfileRead, status_code=status.HTTP_201_CREATED, summary="Create a new learning profile and switch to it")
def create_profile(
    profile_in: LearningProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearningProfileRead:
    source_lang = (profile_in.source_language or "ru").lower().strip()
    target_lang = (profile_in.target_language or "en").lower().strip()
    # Check for duplicate
    existing = db.scalar(
        select(LearningProfile).where(
            LearningProfile.user_id == current_user.id,
            LearningProfile.source_language == source_lang,
            LearningProfile.target_language == target_lang,
        )
    )
    if existing:
        # Just switch to it
        _switch_active_profile(db, current_user.id, existing.id)
        db.refresh(existing)
        return LearningProfileRead.model_validate(existing)
    # Deactivate all existing profiles
    _deactivate_all_profiles(db, current_user.id)
    profile = LearningProfile(
        user_id=current_user.id,
        source_language=source_lang,
        target_language=target_lang,
        is_active=True,
    )
    db.add(profile)
    current_user.native_language = source_lang
    current_user.target_language = target_lang
    current_user.default_source_lang = source_lang
    current_user.default_target_lang = target_lang
    db.commit()
    db.refresh(profile)
    logger.info(f"Created new profile {profile.id} for user {current_user.id}: {source_lang}->{target_lang}")
    return LearningProfileRead.model_validate(profile)


@router.post("/{profile_id}/switch", response_model=LearningProfileRead, summary="Switch active profile")
def switch_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LearningProfileRead:
    profile = db.scalar(
        select(LearningProfile).where(
            LearningProfile.id == profile_id,
            LearningProfile.user_id == current_user.id,
        )
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    _switch_active_profile(db, current_user.id, profile_id)
    db.refresh(profile)
    logger.info(f"Switched to profile {profile_id} for user {current_user.id}")
    return LearningProfileRead.model_validate(profile)


def _deactivate_all_profiles(db: Session, user_id: int) -> None:
    profiles = db.scalars(
        select(LearningProfile).where(LearningProfile.user_id == user_id)
    ).all()
    for p in profiles:
        p.is_active = False
    db.commit()


def _switch_active_profile(db: Session, user_id: int, profile_id: int) -> None:
    _deactivate_all_profiles(db, user_id)
    profile = db.scalar(
        select(LearningProfile).where(
            LearningProfile.id == profile_id,
            LearningProfile.user_id == user_id,
        )
    )
    if profile:
        profile.is_active = True
        user = db.scalar(select(User).where(User.id == user_id))
        if user:
            user.native_language = profile.source_language
            user.target_language = profile.target_language
            user.default_source_lang = profile.source_language
            user.default_target_lang = profile.target_language
        db.commit()
