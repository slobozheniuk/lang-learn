from typing import TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class LearningProfile(Base, TimestampMixin):
    """User learning path profile (e.g. 'ru -> en', 'en -> nl')."""
    __tablename__ = "learning_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", "source_language", "target_language", name="uq_user_learning_profile"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_language: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="profiles")

    @property
    def source_lang(self) -> str:
        return self.source_language

    @source_lang.setter
    def source_lang(self, value: str) -> None:
        self.source_language = value

    @property
    def target_lang(self) -> str:
        return self.target_language

    @target_lang.setter
    def target_lang(self, value: str) -> None:
        self.target_language = value

    @property
    def is_current(self) -> bool:
        return self.is_active

    @is_current.setter
    def is_current(self, value: bool) -> None:
        self.is_active = value

