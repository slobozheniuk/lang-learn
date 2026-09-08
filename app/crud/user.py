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


def ensure_admin_user(db: Session) -> User:
    """Find or create the admin user configured via settings / .env."""
    import logging
    from app.auth.security import hash_password, verify_password
    from app.config import settings

    logger = logging.getLogger("app.crud.user")
    admin_username = settings.ADMIN_USERNAME.strip()
    admin = get_user_by_username(db, admin_username)

    if not admin:
        hashed = hash_password(settings.ADMIN_PASSWORD)
        admin = User(
            username=admin_username,
            hashed_password=hashed,
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        db.flush()

        initial_profile = LearningProfile(
            user_id=admin.id,
            source_language="ru",
            target_language="en",
            is_active=True,
        )
        db.add(initial_profile)
        db.commit()
        db.refresh(admin)
        logger.info(f"Admin user '{admin_username}' provisioned successfully (id={admin.id}).")
    else:
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

