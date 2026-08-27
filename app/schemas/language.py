from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LanguageBase(BaseModel):
    code: str = Field(..., max_length=10, description="ISO-like language code, e.g., 'ru', 'en', 'nl'")
    name: str = Field(..., max_length=50, description="Full language name, e.g., 'Russian'")


class LanguageCreate(LanguageBase):
    pass


class LanguageRead(LanguageBase):
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
