from sqlalchemy import select
from sqlalchemy.orm import Session

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
    native_lang = (user_in.native_language or user_in.default_source_lang or "ru").lower().strip()
    target_lang = (user_in.target_language or user_in.default_target_lang or "en").lower().strip()
    user = User(
        username=user_in.username.strip(),
        hashed_password=hashed_password,
        native_language=native_lang,
        target_language=target_lang,
        default_source_lang=native_lang,
        default_target_lang=target_lang,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, user_in: UserUpdate) -> User:
    if user_in.native_language is not None or user_in.default_source_lang is not None:
        lang = (user_in.native_language or user_in.default_source_lang or "").lower().strip()
        user.native_language = lang
        user.default_source_lang = lang
    if user_in.target_language is not None or user_in.default_target_lang is not None:
        lang = (user_in.target_language or user_in.default_target_lang or "").lower().strip()
        user.target_language = lang
        user.default_target_lang = lang
    if user_in.username is not None:
        user.username = user_in.username.strip()

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
