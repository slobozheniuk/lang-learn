from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.language import Language
    from app.models.user_word_stats import UserWordStats


class Word(Base, TimestampMixin):
    __tablename__ = "words"

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
