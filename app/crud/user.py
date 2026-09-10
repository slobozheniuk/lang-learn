import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

logger = logging.getLogger("app.crud.user")


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.strip()))


def get_user_by_username_or_email(db: Session, identifier: str) -> User | None:
    """Search by username only (email column has been removed)."""
    return get_user_by_username(db, identifier)


def _create_user_with_profile(db: Session, username: str, hashed_password: str, source_lang: str, target_lang: str, is_admin: bool = False) -> User:
    user = User(
        username=username.strip(),
        hashed_password=hashed_password,
        is_active=True,
        is_admin=is_admin,
    )
    db.add(user)
    db.flush()
    db.add(
        LearningProfile(
            user_id=user.id,
            source_language=source_lang.lower().strip(),
            target_language=target_lang.lower().strip(),
            is_active=True,
        )
    )
    db.commit()
    db.refresh(user)
    return user


def create_user(db: Session, user_in: UserCreate, hashed_password: str) -> User:
    return _create_user_with_profile(
        db,
        username=user_in.username,
        hashed_password=hashed_password,
        source_lang=user_in.source_language,
        target_lang=user_in.target_language,
    )


def update_user(db: Session, user: User, user_in: UserUpdate) -> User:
    if user_in.username is not None:
        user.username = user_in.username.strip()

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_admin_user(db: Session) -> User:
    """Find or create the admin user configured via settings / .env."""
    from app.auth.security import hash_password, verify_password
    from app.config import settings

    admin_username = settings.ADMIN_USERNAME.strip()
    admin = get_user_by_username(db, admin_username)

    if not admin:
        admin = _create_user_with_profile(
            db,
            username=admin_username,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            source_lang="ru",
            target_lang="en",
            is_admin=True,
        )
        logger.info(f"Admin user '{admin_username}' provisioned successfully (id={admin.id}).")
        return admin

    updated = False
    if not admin.is_admin:
        admin.is_admin = True
        updated = True
    if not verify_password(settings.ADMIN_PASSWORD, admin.hashed_password):
        admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
        updated = True
    if updated:
        db.add(admin)
        db.commit()
        db.refresh(admin)
        logger.info(f"Admin user '{admin_username}' synchronized (is_admin=True, password updated).")

    return admin
