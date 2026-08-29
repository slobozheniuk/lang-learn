from typing import TYPE_CHECKING
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.learning_profile import LearningProfile
    from app.models.lesson import Lesson
    from app.models.user_word_stats import UserWordStats


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    native_language: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    default_source_lang: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    default_target_lang: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def get_active_profile(self):
        """Return the currently active LearningProfile, or None."""
        for profile in self.profiles:
            if profile.is_active:
                return profile
        if self.profiles:
            return self.profiles[0]
        return None

    profiles: Mapped[list["LearningProfile"]] = relationship(
        "LearningProfile", back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    word_stats: Mapped[list["UserWordStats"]] = relationship(
        "UserWordStats", back_populates="user", cascade="all, delete-orphan"
    )
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson", back_populates="user", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        "Job", back_populates="user", cascade="all, delete-orphan"
    )
