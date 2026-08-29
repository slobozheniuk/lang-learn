from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel, Field


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

    @classmethod
    def model_validate(cls, obj: Any, *args: Any, **kwargs: Any) -> "LLMQuizQuestion":
        if isinstance(obj, dict):
            # Sync correct_index and correct_option_index
            if "correct_option_index" in obj and "correct_index" not in obj:
                obj["correct_index"] = obj["correct_option_index"]
            elif "correct_index" in obj and "correct_option_index" not in obj:
                obj["correct_option_index"] = obj["correct_index"]
            
            opts = obj.get("options", [])
            idx = obj.get("correct_index", 0)
            if not obj.get("correct_answer") and isinstance(opts, list) and isinstance(idx, int) and 0 <= idx < len(opts):
                obj["correct_answer"] = opts[idx]
        return super().model_validate(obj, *args, **kwargs)


class LLMQuizResponse(BaseModel):
    title: str = Field(..., description="Descriptive title for the quiz lesson")
    questions: list[LLMQuizQuestion] = Field(
        default_factory=list,
        description="Structured list of multiple-choice quiz questions",
    )


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
        pass

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
        pass

    async def generate_quiz_questions(
        self,
        words: list[Any],
        native_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        """Prompt LLM for multiple choice questions in JSON:
        {"title": "...", "questions": [{"question": "...", "options": ["..."], "correct_index": 0, "explanation": "..."}]}
        """
        return await self.generate_quiz(
            words=words,
            source_lang=native_lang,
            target_lang=target_lang,
            text=text,
            title=title,
        )

    @abstractmethod
    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        """Raw completion method."""
        pass
