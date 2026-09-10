from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel, Field, model_validator

from app.schemas.ilya_frank import IlyaFrankResponse


class LLMWordItem(BaseModel):
    source_text: str = Field(..., description="The word or collocation in the source language")
    target_text: str = Field(..., description="The translated word or collocation in the target language")
    pos: str | None = Field(default=None, description="Part of speech (e.g. noun, verb, adjective, phrase)")
    phonetic: str | None = Field(default=None, description="Phonetic transcription (IPA or pronunciation guide)")
    lemma: str | None = Field(default=None, description="Base/dictionary lemma of the target word")
    context_phrase: str | None = Field(default=None, description="Example sentence or contextual usage phrase")


class LLMTranslationResponse(BaseModel):
    title: str | None = Field(default=None, description="Optional descriptive title for the lesson or text snippet")
    items: list[LLMWordItem] = Field(
        default_factory=list,
        description="List of extracted smallest meaningful vocabulary units and collocations",
    )


class LLMQuizQuestion(BaseModel):
    id: int | None = Field(default=None, description="Optional question index or identifier")
    question: str = Field(..., description="The multiple-choice quiz question prompt")
    options: list[str] = Field(..., description="List of answer options")
    correct_index: int = Field(default=0, description="0-based index of the correct answer in options")
    correct_option_index: int | None = Field(default=None, description="Alias for correct_index")
    correct_answer: str | None = Field(default=None, description="The exact correct answer string matching options[correct_index]")
    explanation: str | None = Field(default=None, description="Short explanation why this answer is correct")
    target_word: str | None = Field(default=None, description="The vocabulary word being tested")

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
            if isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts) and not data.get("correct_answer"):
                data["correct_answer"] = opts[idx]
        return data


class LLMQuizResponse(BaseModel):
    title: str = Field(..., description="Descriptive title for the quiz lesson")
    questions: list[LLMQuizQuestion] = Field(
        default_factory=list,
        description="Structured list of multiple-choice quiz questions",
    )


class LLMChunkItem(BaseModel):
    id: int | str | None = Field(default=None, description="Optional chunk identifier or index")
    text: str = Field(..., description="The word, phrase, idiom, punctuation, or token text")
    is_selectable: bool = Field(default=True, description="Whether this chunk represents a selectable vocabulary token or phrase")
    is_word: bool = Field(default=True, description="Alias for is_selectable")
    lemma: str | None = Field(default=None, description="Dictionary lemma / base form")
    pos: str | None = Field(default=None, description="Part of speech or token type (e.g. noun, verb, idiom, phrase)")
    translation: str | None = Field(default=None, description="Optional translation in native language")

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


class LLMChunkResponse(BaseModel):
    title: str | None = Field(default=None, description="Descriptive title for the text or lesson")
    chunks: list[LLMChunkItem] = Field(
        default_factory=list,
        description="Ordered list of text chunks representing the full formatted text",
    )
    raw_text: str | None = Field(default=None, description="Original raw input text")
    lesson_id: int | None = Field(default=None, description="Optional lesson identifier if created")


class LLMProvider(ABC):
    """Provider-agnostic interface for LLM services."""

    @abstractmethod
    async def extract_vocabulary(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> LLMTranslationResponse:
        """Extract vocabulary items with translations, POS, phonetic, and context."""
        ...

    @abstractmethod
    async def generate_quiz(
        self,
        words: list[dict[str, Any]],
        source_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        """Generate structured multiple-choice quiz questions for given words or text."""
        ...

    async def generate_quiz_questions(
        self,
        words: list[Any],
        native_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        """Legacy alias of generate_quiz that accepts mixed word input formats."""
        normalized: list[dict[str, Any]] = []
        for w in words:
            if isinstance(w, dict):
                normalized.append(w)
            elif isinstance(w, str):
                normalized.append({"text": w, "translation": w})
            elif hasattr(w, "text"):
                normalized.append(
                    {
                        "text": getattr(w, "text", ""),
                        "translation": getattr(w, "translation", ""),
                        "pos": getattr(w, "pos", None),
                        "phonetic": getattr(w, "phonetic", None),
                        "context_phrase": getattr(w, "context_phrase", None),
                    }
                )
            else:
                normalized.append({"text": str(w)})
        return await self.generate_quiz(
            words=normalized, source_lang=native_lang, target_lang=target_lang, text=text, title=title
        )

    @abstractmethod
    async def send_message(
        self,
        system_prompt: str | None = None,
        user_content: str | None = None,
        temperature: float = 0.2,
        response_format: dict[str, Any] | None = None,
        *,
        prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Send a message to the LLM with user content and optional system prompt, returning raw string response."""
        ...

    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        """Raw completion method delegating to send_message."""
        return await self.send_message(system_prompt=system_prompt, user_content=prompt)

    @abstractmethod
    async def generate_ilya_frank(
        self,
        text: str,
        selected_words: list[str],
        source_lang: str,
        target_lang: str,
    ) -> IlyaFrankResponse:
        """Generate Ilya Frank dual-pass text adaptation enforcing 27 canonical rules."""
        ...
