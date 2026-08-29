from app.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAILikeProvider


def get_llm_provider(
    force_mock: bool = False,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> LLMProvider:
    """Factory function that returns configured LLM provider or MockLLMProvider."""
    effective_key = api_key or settings.effective_llm_api_key

    if force_mock or not effective_key:
        return MockLLMProvider()

    return OpenAILikeProvider(
        api_key=effective_key,
        base_url=base_url or settings.LLM_BASE_URL,
        model=model or settings.LLM_MODEL,
    )
