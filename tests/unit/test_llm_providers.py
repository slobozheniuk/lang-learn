import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm.base import LLMQuizQuestion, LLMQuizResponse, LLMTranslationResponse, LLMWordItem
from app.services.llm.factory import get_llm_provider
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAILikeProvider


def test_build_system_prompt_language_pair():
    prompt_ru_en = OpenAILikeProvider.build_system_prompt(source_lang="ru", target_lang="en")
    assert "Russian (ru)" in prompt_ru_en
    assert "English (en)" in prompt_ru_en
    assert "Native language: Russian (ru)" in prompt_ru_en
    assert "Learning (target) language: English (en)" in prompt_ru_en
    assert "specifically translate between the user's learning (target) language" in prompt_ru_en

    prompt_nl_es = OpenAILikeProvider.build_system_prompt(source_lang="nl", target_lang="es")
    assert "Dutch (nl)" in prompt_nl_es
    assert "Spanish (es)" in prompt_nl_es
    assert "Native language: Dutch (nl)" in prompt_nl_es
    assert "Learning (target) language: Spanish (es)" in prompt_nl_es


def test_build_quiz_system_prompt():
    prompt = OpenAILikeProvider.build_quiz_system_prompt(source_lang="ru", target_lang="en")
    assert "Russian (ru)" in prompt
    assert "English (en)" in prompt
    assert "correct_index" in prompt
    assert "options" in prompt
    assert "questions" in prompt


@pytest.mark.asyncio
async def test_mock_llm_provider_word_pair():
    provider = MockLLMProvider()
    resp = await provider.extract_vocabulary("serendipity - счастливая случайность", "ru", "en")
    assert isinstance(resp, LLMTranslationResponse)
    assert len(resp.items) == 1
    item = resp.items[0]
    assert item.target_text == "serendipity"
    assert item.source_text == "счастливая случайность"
    assert item.pos == "noun"
    assert item.phonetic is not None
    assert item.context_phrase is not None


@pytest.mark.asyncio
async def test_mock_llm_provider_single_word():
    provider = MockLLMProvider()
    resp = await provider.extract_vocabulary("gezellig", "ru", "nl")
    assert isinstance(resp, LLMTranslationResponse)
    assert len(resp.items) == 1
    assert resp.items[0].target_text == "gezellig"
    assert resp.items[0].source_text == "уютный"


@pytest.mark.asyncio
async def test_mock_llm_provider_sentence_chunking():
    provider = MockLLMProvider()
    text = "The quick brown fox jumps over the lazy dog and sleeps"
    resp = await provider.extract_vocabulary(text, "ru", "en")
    assert isinstance(resp, LLMTranslationResponse)
    assert len(resp.items) > 5
    assert resp.title is not None
    for item in resp.items:
        assert item.target_text
        assert item.source_text
        assert item.context_phrase


@pytest.mark.asyncio
async def test_mock_llm_provider_generate_quiz():
    provider = MockLLMProvider()
    words = [
        {"text": "dog", "translation": "собака", "pos": "noun", "context_phrase": "The dog barked."},
        {"text": "cat", "translation": "кошка", "pos": "noun", "context_phrase": "The cat purred."},
    ]
    quiz = await provider.generate_quiz(words=words, source_lang="ru", target_lang="en", title="Animal Quiz")
    assert isinstance(quiz, LLMQuizResponse)
    assert len(quiz.questions) == 2
    assert quiz.title == "Animal Quiz"

    for q in quiz.questions:
        assert isinstance(q, LLMQuizQuestion)
        assert len(q.options) == 4
        assert 0 <= q.correct_index < 4
        assert q.options[q.correct_index] == q.correct_answer
        assert q.explanation is not None


@pytest.mark.asyncio
async def test_openai_provider_success():
    provider = OpenAILikeProvider(
        api_key="test_api_key",
        base_url="https://inference-api.nousresearch.com/v1",
        model="google/gemini-3.7-flash",
    )

    fake_response_data = {
        "choices": [
            {
                "message": {
                    "content": '```json\n{"title": "Forest Animals", "items": [{"source_text": "собака", "target_text": "dog", "pos": "noun", "phonetic": "/dɒɡ/", "lemma": "dog", "context_phrase": "The dog barked."}]}\n```'
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = fake_response_data
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        res = await provider.extract_vocabulary("dog", "ru", "en")
        assert res.title == "Forest Animals"
        assert len(res.items) == 1
        assert res.items[0].target_text == "dog"
        assert res.items[0].source_text == "собака"

        # Verify payload sent to LLM included system prompt with language pair
        called_payload = mock_post.call_args[1]["json"]
        system_msg = next(m["content"] for m in called_payload["messages"] if m["role"] == "system")
        assert "Russian (ru)" in system_msg
        assert "English (en)" in system_msg


@pytest.mark.asyncio
async def test_openai_provider_generate_quiz_success():
    provider = OpenAILikeProvider(
        api_key="test_api_key",
        base_url="https://inference-api.nousresearch.com/v1",
        model="google/gemini-3.7-flash",
    )

    fake_quiz_json = {
        "title": "Advanced Vocabulary Quiz",
        "questions": [
            {
                "question": "What is the meaning of 'luminary'?",
                "options": ["светило", "собака", "книга", "дом"],
                "correct_index": 0,
                "explanation": "'luminary' translates to 'светило'.",
            }
        ],
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": f"```json\n{json.dumps(fake_quiz_json)}\n```"}}]
    }
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        quiz = await provider.generate_quiz(
            words=[{"text": "luminary", "translation": "светило"}],
            source_lang="ru",
            target_lang="en",
        )
        assert quiz.title == "Advanced Vocabulary Quiz"
        assert len(quiz.questions) == 1
        q = quiz.questions[0]
        assert q.question == "What is the meaning of 'luminary'?"
        assert q.options[0] == "светило"
        assert q.correct_index == 0


@pytest.mark.asyncio
async def test_openai_provider_invalid_json_handling():
    provider = OpenAILikeProvider(api_key="test_key")

    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Not a json response!"}}]
    }
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(ValueError, match="invalid non-JSON"):
            await provider.extract_vocabulary("hello", "ru", "en")


@pytest.mark.asyncio
async def test_mock_llm_chunk_text_idioms_and_words():
    provider = MockLLMProvider()
    text = "Yesterday, he decided to get off the train and look forward to the meeting."
    res = await provider.chunk_text(text, source_lang="ru", target_lang="en")

    assert res.title is not None
    assert res.raw_text == text
    assert len(res.chunks) > 5

    # Check text reconstruction
    reconstructed = "".join(c.text for c in res.chunks)
    assert reconstructed == text

    # Verify idioms are single chunks
    chunk_texts = [c.text for c in res.chunks]
    assert "get off" in chunk_texts
    assert "look forward to" in chunk_texts

    # Verify selectable vs non-selectable
    idiom_chunk = next(c for c in res.chunks if c.text == "get off")
    assert idiom_chunk.is_selectable is True
    assert idiom_chunk.is_word is True
    assert idiom_chunk.pos == "phrase"

    comma_chunk = next(c for c in res.chunks if c.text == ",")
    assert comma_chunk.is_selectable is False
    assert comma_chunk.is_word is False


@pytest.mark.asyncio
async def test_openai_provider_chunk_text_success():
    provider = OpenAILikeProvider(
        api_key="test_api_key",
        base_url="https://inference-api.nousresearch.com/v1",
        model="google/gemini-3.7-flash",
    )

    fake_chunk_json = {
        "title": "Train Journey",
        "chunks": [
            {"text": "He decided to", "is_selectable": True, "lemma": "decide to", "pos": "phrase"},
            {"text": " ", "is_selectable": False},
            {"text": "get off", "is_selectable": True, "lemma": "get off", "pos": "phrase", "translation": "выйти"},
            {"text": " the train.", "is_selectable": True, "lemma": "train", "pos": "noun"},
        ],
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps(fake_chunk_json)}}]
    }
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        res = await provider.chunk_text("He decided to get off the train.", "ru", "en")
        assert res.title == "Train Journey"
        assert len(res.chunks) == 4
        assert res.chunks[2].text == "get off"
        assert res.chunks[2].is_selectable is True
        assert res.chunks[2].is_word is True


def test_llm_factory():
    mock_p = get_llm_provider(force_mock=True)
    assert isinstance(mock_p, MockLLMProvider)

    with patch("app.config.settings.NOUS_API_KEY", "nous-key-123"):
        real_p = get_llm_provider(force_mock=False)
        assert isinstance(real_p, OpenAILikeProvider)
        assert real_p.api_key == "nous-key-123"

