from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.language import Language
    from app.models.lesson_word import LessonWord
    from app.models.user_word_stats import UserWordStats
    from app.models.word_association import WordAssociation


class Word(Base, TimestampMixin):
    __tablename__ = "words"
    __table_args__ = (
        UniqueConstraint("language_code", "text", name="uq_lang_word_text"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    language_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("languages.code", ondelete="CASCADE"), index=True, nullable=False
    )
    text: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    lemma: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pos: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Part of speech
    phonetic: Mapped[str | None] = mapped_column(String(100), nullable=True)  # IPA
    translation: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_phrase: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    language: Mapped["Language"] = relationship("Language", back_populates="words")
    user_stats: Mapped[list["UserWordStats"]] = relationship(
        "UserWordStats", back_populates="word", cascade="all, delete-orphan"
    )
    source_associations: Mapped[list["WordAssociation"]] = relationship(
        "WordAssociation",
        foreign_keys="WordAssociation.source_word_id",
        back_populates="source_word",
        cascade="all, delete-orphan",
    )
    target_associations: Mapped[list["WordAssociation"]] = relationship(
        "WordAssociation",
        foreign_keys="WordAssociation.target_word_id",
        back_populates="target_word",
        cascade="all, delete-orphan",
    )
    lesson_words: Mapped[list["LessonWord"]] = relationship(
        "LessonWord", back_populates="word", cascade="all, delete-orphan"
    )
