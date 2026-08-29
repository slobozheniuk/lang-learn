from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lesson import LessonRead
from app.schemas.word import WordRead


class JobBase(BaseModel):
    input_text: str
    source_lang: str = Field(default="ru", max_length=10)
    target_lang: str = Field(default="en", max_length=10)
    type: str = Field(default="text_translation", max_length=50)


class JobCreate(JobBase):
    pass


class JobRead(JobBase):
    id: str
    user_id: int
    status: str
    lesson_id: int | None = None
    result_json: str | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TextSubmissionRequest(BaseModel):
    text: str = Field(..., description="Single word, short phrase, sentence, or longer text")
    source_lang: str | None = Field(default=None, max_length=10, description="Source/native language code (defaults to user profile)")
    target_lang: str | None = Field(default=None, max_length=10, description="Target learning language code (defaults to user profile)")
    wait: bool = Field(default=True, description="Whether to wait synchronously for processing to complete")


class TextSubmissionResponse(BaseModel):
    job_id: str
    status: str
    is_lesson: bool = False
    is_multi_sentence: bool = False
    sentence_count: int = 1
    can_create_lesson: bool = False
    lesson: LessonRead | None = None
    words: list[WordRead] = Field(default_factory=list)
    error_message: str | None = None
