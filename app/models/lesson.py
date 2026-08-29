from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.lesson_word import LessonWord
    from app.models.user import User


class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_lang: Mapped[str] = mapped_column(String(10), nullable=False)
    target_lang: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[str] = mapped_column(String(50), default="text", nullable=False)  # text, youtube, manual, revision
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)   # pending, processing, ready, completed, failed
    quiz_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded multiple-choice quiz questions
    is_completed: Mapped[bool] = mapped_column(default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="lessons")
    lesson_words: Mapped[list["LessonWord"]] = relationship(
        "LessonWord", back_populates="lesson", cascade="all, delete-orphan", order_by="LessonWord.order_index"
    )
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="lesson")

