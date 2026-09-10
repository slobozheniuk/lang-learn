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
    text: str = Field(..., max_length=255, description="Word, collocation, or phrase in the learning language")
    lemma: str | None = Field(default=None, max_length=255, description="Dictionary base form")
    pos: str | None = Field(default=None, max_length=50, description="Part of speech or token type")
    phonetic: str | None = Field(default=None, max_length=100, description="IPA phonetic transcription")
    translation: str | None = Field(default=None, description="Translation in the native language")
    context_phrase: str | None = Field(default=None, description="Contextual example sentence")
    audio_url: str | None = Field(default=None, max_length=500)
    literal_translation: str | None = None
    literary_translation: str | None = None
    gender: str | None = None
    is_irregular: bool | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def sync_word_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Resolve learning language token: text, target_text, word
            target = data.get("text") or data.get("target_text") or data.get("word")
            if target is not None:
                data["text"] = target

            # Resolve native language translation: translation, source_text
            source = data.get("translation") or data.get("source_text")
            if source is not None:
                data["translation"] = source
        return data

    @property
    def word(self) -> str:
        return self.text

    @property
    def target_text(self) -> str:
        return self.text

    @property
    def source_text(self) -> str | None:
        return self.translation


class WordCreate(WordBase):
    language_code: str = Field(..., max_length=10)


class WordRead(WordBase):
    id: int
    created_at: datetime
    updated_at: datetime
    user_stats: UserWordStatsRead | None = None

    model_config = ConfigDict(from_attributes=True)
