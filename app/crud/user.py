from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower().strip()))


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username.strip()))


def get_user_by_username_or_email(db: Session, identifier: str) -> User | None:
    ident = identifier.strip()
    return db.scalar(
        select(User).where(
            (User.username == ident) | (User.email == ident.lower())
        )
    )


def create_user(db: Session, user_in: UserCreate, hashed_password: str) -> User:
    user = User(
        email=user_in.email.lower().strip(),
        username=user_in.username.strip(),
        hashed_password=hashed_password,
        default_source_lang=user_in.default_source_lang.lower(),
        default_target_lang=user_in.default_target_lang.lower(),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
