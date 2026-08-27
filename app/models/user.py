from typing import TYPE_CHECKING
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.lesson import Lesson
    from app.models.user_word_stats import UserWordStats


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    default_source_lang: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    default_target_lang: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    word_stats: Mapped[list["UserWordStats"]] = relationship(
        "UserWordStats", back_populates="user", cascade="all, delete-orphan"
    )
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson", back_populates="user", cascade="all, delete-orphan"
    )
