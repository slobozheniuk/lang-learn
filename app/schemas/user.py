from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.profile import LearningProfileRead


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    native_language: str = Field(default="ru", max_length=10)
    target_language: str = Field(default="en", max_length=10)
    default_source_lang: str = Field(default="ru", max_length=10)
    default_target_lang: str = Field(default="en", max_length=10)

    @model_validator(mode="before")
    @classmethod
    def sync_language_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Sync native_language and default_source_lang
            if "native_language" in data and "default_source_lang" not in data:
                data["default_source_lang"] = data["native_language"]
            elif "default_source_lang" in data and "native_language" not in data:
                data["native_language"] = data["default_source_lang"]

            # Sync target_language and default_target_lang
            if "target_language" in data and "default_target_lang" not in data:
                data["default_target_lang"] = data["target_language"]
            elif "default_target_lang" in data and "target_language" not in data:
                data["target_language"] = data["default_target_lang"]
        return data


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Raw plaintext password for registration")


class UserUpdate(BaseModel):
    native_language: str | None = Field(default=None, max_length=10)
    target_language: str | None = Field(default=None, max_length=10)
    default_source_lang: str | None = Field(default=None, max_length=10)
    default_target_lang: str | None = Field(default=None, max_length=10)
    username: str | None = Field(default=None, min_length=3, max_length=50)

    @model_validator(mode="before")
    @classmethod
    def sync_language_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "native_language" in data and "default_source_lang" not in data:
                data["default_source_lang"] = data["native_language"]
            elif "default_source_lang" in data and "native_language" not in data:
                data["native_language"] = data["default_source_lang"]

            if "target_language" in data and "default_target_lang" not in data:
                data["default_target_lang"] = data["target_language"]
            elif "default_target_lang" in data and "target_language" not in data:
                data["target_language"] = data["default_target_lang"]
        return data


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    profiles: list[LearningProfileRead] = []

    model_config = ConfigDict(from_attributes=True)
