from typing import Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class UserWordStatsRead(BaseModel):
    id: int
    user_id: int
    word_id: int
    repetition_number: int
    interval_days: float
    ease_factor: float
    next_review_at: datetime
    last_reviewed_at: datetime | None
    recall_count: int
    fail_count: int

    model_config = ConfigDict(from_attributes=True)


class WordBase(BaseModel):
    language_code: str | None = Field(default=None, max_length=10)
    text: str = Field(..., max_length=255)
    lemma: str | None = Field(default=None, max_length=255)
    pos: str | None = Field(default=None, max_length=50)
    phonetic: str | None = Field(default=None, max_length=100)
    translation: str | None = None
    context_phrase: str | None = None
    audio_url: str | None = Field(default=None, max_length=500)
    literal_translation: str | None = None
    literary_translation: str | None = None
    gender: str | None = None
    is_irregular: bool | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sync_word_and_text(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "text" not in data and "word" in data:
                data["text"] = data["word"]
            elif "word" not in data and "text" in data:
                data["word"] = data["text"]
        return data

    @property
    def word(self) -> str:
        return self.text


class WordCreate(WordBase):
    language_code: str = Field(..., max_length=10)


class WordRead(WordBase):
    id: int
    created_at: datetime
    updated_at: datetime
    user_stats: UserWordStatsRead | None = None

    model_config = ConfigDict(from_attributes=True)
