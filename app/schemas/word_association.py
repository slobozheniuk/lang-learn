from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class WordAssociationBase(BaseModel):
    source_word_id: int
    target_word_id: int
    source_lang: str = Field(..., max_length=10)
    target_lang: str = Field(..., max_length=10)
    context: str | None = None


class WordAssociationCreate(WordAssociationBase):
    pass


class WordAssociationRead(WordAssociationBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
