from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.lesson import Lesson
    from app.models.word import Word


class LessonWord(Base, TimestampMixin):
    """Association table linking lessons with their member vocabulary words."""
    __tablename__ = "lesson_words"
    __table_args__ = (
        UniqueConstraint("lesson_id", "word_id", name="uq_lesson_word"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), index=True, nullable=False
    )
    word_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("words.id", ondelete="CASCADE"), index=True, nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="lesson_words")
    word: Mapped["Word"] = relationship("Word", back_populates="lesson_words")
