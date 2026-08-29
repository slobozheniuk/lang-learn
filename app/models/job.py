import uuid
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.lesson import Lesson
    from app.models.user import User


class Job(Base, TimestampMixin):
    """Asynchronous background processing job for translation and lesson generation."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(
        String(50), default="text_translation", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="queued", index=True, nullable=False
    )  # queued, processing, completed, failed
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_lang: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)
    target_lang: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    lesson_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("lessons.id", ondelete="SET NULL"), index=True, nullable=True
    )
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="jobs")
    lesson: Mapped["Lesson | None"] = relationship("Lesson", back_populates="jobs")
