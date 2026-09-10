import json
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.word import WordRead

MAX_TITLE_LENGTH = 250


def truncate_title(title: str | None, fallback: str) -> str:
    """Return a non-empty title capped at the DB column length."""
    title = (title or "").strip() or fallback
    return title[:255]


class QuizQuestion(BaseModel):
    id: int | None = None
    question: str = Field(..., description="Multiple-choice question prompt")
    options: list[str] = Field(..., description="List of choices")
    correct_index: int = Field(default=0, description="0-based index of correct option")
    correct_option_index: int | None = Field(default=None, description="0-based index of correct option")
    correct_answer: str | None = Field(default=None, description="The correct answer string")
    explanation: str | None = Field(default=None, description="Explanation for why the answer is correct")
    target_word: str | None = Field(default=None, description="The target vocabulary word being tested")

    @model_validator(mode="before")
    @classmethod
    def sync_correct_index_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "correct_option_index" in data and "correct_index" not in data:
                data["correct_index"] = data["correct_option_index"]
            elif "correct_index" in data and "correct_option_index" not in data:
                data["correct_option_index"] = data["correct_index"]
            opts = data.get("options")
            idx = data.get("correct_index", 0)
            if not data.get("correct_answer") and isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts):
                data["correct_answer"] = opts[idx]
        return data


class QuizData(BaseModel):
    title: str | None = None
    questions: list[QuizQuestion] = Field(default_factory=list)


class LessonBase(BaseModel):
    source_lang: str = Field(..., max_length=10)
    target_lang: str = Field(..., max_length=10)
    title: str = Field(..., max_length=255)
    raw_input: str
    input_type: str = Field(default="text", max_length=50)  # text, reading, quiz, revision


class LessonCreate(LessonBase):
    quiz_data: str | dict | list | None = None
    chunk_data: str | dict | list | None = None
    ilya_frank_data: str | dict | list | None = None
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

    @model_validator(mode="before")
    @classmethod
    def sync_selectable_and_word(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "is_word" in data and "is_selectable" not in data:
                data["is_selectable"] = bool(data["is_word"])
            elif "is_selectable" in data and "is_word" not in data:
                data["is_word"] = bool(data["is_selectable"])
            elif "is_selectable" in data and "is_word" in data:
                if not data["is_selectable"]:
                    data["is_word"] = False
                elif not data["is_word"]:
                    data["is_selectable"] = False
        return data


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


def _parse_json_field(v: Any) -> Any:
    """Decode a JSON string field (quiz/chunk/frank data); pass other values through."""
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return v
    return v


class LessonRead(LessonBase):
    id: int
    user_id: int
    status: str
    is_completed: bool = False
    quiz_data: Any | None = None
    chunk_data: Any | None = None
    ilya_frank_data: Any | None = None
    created_at: datetime
    updated_at: datetime
    words: list[WordRead] = Field(default_factory=list)

    @field_validator("quiz_data", "chunk_data", "ilya_frank_data", mode="before")
    @classmethod
    def parse_json_columns(cls, v: Any) -> Any:
        return _parse_json_field(v)

    model_config = ConfigDict(from_attributes=True)
