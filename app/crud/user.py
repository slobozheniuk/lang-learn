from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_email(db: Session, email: str) -> User | None:
    """Stub kept for backward compatibility - always returns None (email removed)."""
    return None


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.strip()))


def get_user_by_username_or_email(db: Session, identifier: str) -> User | None:
    """Search by username only (email column has been removed)."""
    ident = identifier.strip()
    return db.scalar(select(User).where(User.username == ident))


def create_user(db: Session, user_in: UserCreate, hashed_password: str) -> User:
    source_lang = user_in.source_language.lower().strip()
    target_lang = user_in.target_language.lower().strip()
    user = User(
        username=user_in.username.strip(),
        hashed_password=hashed_password,
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Create initial active learning profile for the user
    initial_profile = LearningProfile(
        user_id=user.id,
        source_language=source_lang,
        target_language=target_lang,
        is_active=True,
    )
    db.add(initial_profile)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, user_in: UserUpdate) -> User:
    if user_in.username is not None:
        user.username = user_in.username.strip()

    db.add(user)
    db.commit()
    db.refresh(user)
    return user

