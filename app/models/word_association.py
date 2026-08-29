from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.word import Word


class WordAssociation(Base, TimestampMixin):
    """Dedicated translation association table linking source and target language word entries."""
    __tablename__ = "word_associations"
    __table_args__ = (
        UniqueConstraint("source_word_id", "target_word_id", name="uq_source_target_association"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_word_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("words.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_word_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("words.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_lang: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    target_lang: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_word: Mapped["Word"] = relationship(
        "Word", foreign_keys=[source_word_id], back_populates="source_associations"
    )
    target_word: Mapped["Word"] = relationship(
        "Word", foreign_keys=[target_word_id], back_populates="target_associations"
    )
