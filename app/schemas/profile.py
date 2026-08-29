from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator


class LearningProfileBase(BaseModel):
    source_language: str = Field(default="ru", max_length=10)
    target_language: str = Field(default="en", max_length=10)

    @model_validator(mode="before")
    @classmethod
    def map_field_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "source_lang" in data and "source_language" not in data:
                data["source_language"] = data["source_lang"]
            if "target_lang" in data and "target_language" not in data:
                data["target_language"] = data["target_lang"]
        return data


class LearningProfileCreate(LearningProfileBase):
    pass


class LearningProfileRead(LearningProfileBase):
    id: int
    user_id: int
    is_active: bool = True
    is_current: bool = True
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def sync_is_current(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "is_active" in data and "is_current" not in data:
                data["is_current"] = data["is_active"]
            elif "is_current" in data and "is_active" not in data:
                data["is_active"] = data["is_current"]
        elif hasattr(data, "is_active") and not hasattr(data, "is_current"):
            setattr(data, "is_current", getattr(data, "is_active"))
        return data
