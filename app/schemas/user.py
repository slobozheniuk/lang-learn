from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.profile import LearningProfileRead


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Raw plaintext password for registration")
    source_language: str = Field(..., max_length=10)
    target_language: str = Field(..., max_length=10)

    @model_validator(mode="before")
    @classmethod
    def map_legacy_language_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            src = data.get("source_language") or data.get("native_language") or data.get("default_source_lang")
            tgt = data.get("target_language") or data.get("default_target_lang")
            if src:
                data["source_language"] = src
            if tgt:
                data["target_language"] = tgt
        return data


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    profiles: list[LearningProfileRead] = []

    model_config = ConfigDict(from_attributes=True)
