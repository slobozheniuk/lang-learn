from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.word import Word


class Language(Base):
    __tablename__ = "languages"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)  # e.g., 'ru', 'en', 'nl'
    name: Mapped[str] = mapped_column(String(50), nullable=False)    # e.g., 'Russian', 'English', 'Dutch'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    words: Mapped[list["Word"]] = relationship(
        "Word", back_populates="language", cascade="all, delete-orphan"
    )
