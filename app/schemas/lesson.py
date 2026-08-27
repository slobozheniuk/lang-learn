from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LessonBase(BaseModel):
    source_lang: str = Field(..., max_length=10)
    target_lang: str = Field(..., max_length=10)
    title: str = Field(..., max_length=255)
    raw_input: str
    input_type: str = Field(default="text", max_length=50)  # text, youtube, manual


class LessonCreate(LessonBase):
    pass


class LessonRead(LessonBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
