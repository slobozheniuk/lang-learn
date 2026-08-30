import json
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.word import WordRead


class QuizQuestion(BaseModel):
    id: int | None = None
    question: str = Field(..., description="Multiple-choice question prompt")
    options: list[str] = Field(..., description="List of choices")
    correct_index: int = Field(default=0, description="0-based index of correct option")
    correct_option_index: int | None = Field(default=None, description="0-based index of correct option")
    correct_answer: str | None = Field(default=None, description="The correct answer string")
    explanation: str | None = Field(default=None, description="Explanation for why the answer is correct")
    target_word: str | None = Field(default=None, description="The target vocabulary word being tested")

    @classmethod
    def model_validate(cls, obj: Any, *args: Any, **kwargs: Any) -> "QuizQuestion":
        if isinstance(obj, dict):
            if "correct_option_index" in obj and "correct_index" not in obj:
                obj["correct_index"] = obj["correct_option_index"]
            elif "correct_index" in obj and "correct_option_index" not in obj:
                obj["correct_option_index"] = obj["correct_index"]
            opts = obj.get("options", [])
            idx = obj.get("correct_index", 0)
            if not obj.get("correct_answer") and isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts):
                obj["correct_answer"] = opts[idx]
        return super().model_validate(obj, *args, **kwargs)


class QuizData(BaseModel):
    title: str | None = None
    questions: list[QuizQuestion] = Field(default_factory=list)


class LessonBase(BaseModel):
    source_lang: str = Field(..., max_length=10)
    target_lang: str = Field(..., max_length=10)
    title: str = Field(..., max_length=255)
    raw_input: str
    input_type: str = Field(default="text", max_length=50)  # text, youtube, manual, revision, quiz


class LessonCreate(LessonBase):
    quiz_data: str | dict | list | None = None
    chunk_data: str | dict | list | None = None
    is_completed: bool = False


class LessonQuizGenerateRequest(BaseModel):
    text: str | None = Field(default=None, description="Optional text context or multi-sentence passage")
    word_ids: list[int] | None = Field(default=None, description="Optional word IDs to generate quiz for")
    title: str | None = Field(default=None, description="Optional custom lesson title")
    source_lang: str | None = Field(default=None, max_length=10)
    target_lang: str | None = Field(default=None, max_length=10)


class TextChunkRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw input text to segment into semantic chunks")
    source_lang: str | None = Field(default=None, max_length=10)
    target_lang: str | None = Field(default=None, max_length=10)
    title: str | None = Field(default=None, max_length=255)
    create_lesson: bool = Field(default=False, description="Whether to create a lesson in 'reading' status")


class ChunkItemSchema(BaseModel):
    id: int | str | None = None
    text: str = Field(..., description="Chunk text or token")
    is_selectable: bool = Field(default=True, description="Whether this chunk represents a selectable vocabulary token")
    is_word: bool = Field(default=True, description="Alias for is_selectable")
    lemma: str | None = None
    pos: str | None = None
    translation: str | None = None

    @classmethod
    def model_validate(cls, obj: Any, *args: Any, **kwargs: Any) -> "ChunkItemSchema":
        if isinstance(obj, dict):
            if "is_word" in obj and "is_selectable" not in obj:
                obj["is_selectable"] = bool(obj["is_word"])
            elif "is_selectable" in obj and "is_word" not in obj:
                obj["is_word"] = bool(obj["is_selectable"])
            elif "is_selectable" in obj and "is_word" in obj:
                if not obj["is_selectable"]:
                    obj["is_word"] = False
                elif not obj["is_word"]:
                    obj["is_selectable"] = False
        return super().model_validate(obj, *args, **kwargs)


class LessonChunkResponse(BaseModel):
    title: str | None = None
    chunks: list[ChunkItemSchema] = Field(default_factory=list)
    raw_text: str | None = None
    lesson_id: int | None = None


class LessonPrepareRequest(BaseModel):
    chunks: list[Any] | None = Field(default=None, description="Selected chunk objects or strings")
    selected_chunks: list[Any] | None = Field(default=None, description="Selected chunk objects or tokens")
    selected_words: list[str] | None = Field(default=None, description="Selected word/phrase strings")
    text: str | None = Field(default=None, description="Raw context text if preparing without an existing lesson")
    title: str | None = Field(default=None, max_length=255)
    source_lang: str | None = Field(default=None, max_length=10)
    target_lang: str | None = Field(default=None, max_length=10)


class LessonCompleteRequest(BaseModel):
    is_completed: bool = True
    score: int | None = None
    total: int | None = None


class LessonRead(LessonBase):
    id: int
    user_id: int
    status: str
    is_completed: bool = False
    quiz_data: Any | None = None
    chunk_data: Any | None = None
    created_at: datetime
    updated_at: datetime
    words: list[WordRead] = Field(default_factory=list)

    @field_validator("quiz_data", mode="before")
    @classmethod
    def parse_quiz_json(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

    @field_validator("chunk_data", mode="before")
    @classmethod
    def parse_chunk_json(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

    model_config = ConfigDict(from_attributes=True)

