"""Unit tests for app.services.nlp (SpacyNLPService)."""

import pytest
from unittest.mock import AsyncMock

from app.services.nlp import SpacyNLPService, PHRASAL_VERB_LANGS
from app.services.llm.base import LLMChunkResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _word_chunks(response: LLMChunkResponse):
    """Return only the selectable (word) chunks."""
    return [c for c in response.chunks if c.is_selectable]


def _reconstructed(response: LLMChunkResponse) -> str:
    """Rejoin all chunk texts — must equal the original input."""
    return "".join(c.text for c in response.chunks)


# ---------------------------------------------------------------------------
# Empty / whitespace input
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nlp_empty_text():
    svc = SpacyNLPService()
    result = await svc.chunk_text("", "en")
    assert result.chunks == []
    assert result.raw_text == ""


@pytest.mark.asyncio
async def test_nlp_whitespace_only():
    svc = SpacyNLPService()
    result = await svc.chunk_text("   ", "en")
    assert result.chunks == []


# ---------------------------------------------------------------------------
# English (en_core_web_lg)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nlp_english_basic_reconstruction():
    """Rejoining all chunk texts must reproduce the original string exactly."""
    svc = SpacyNLPService()
    text = "The quick brown fox jumps over the lazy dog."
    result = await svc.chunk_text(text, "en")
    assert _reconstructed(result) == text


@pytest.mark.asyncio
async def test_nlp_english_lemmatization():
    """spaCy should lemmatize 'running' → 'run', 'cats' → 'cat'."""
    svc = SpacyNLPService()
    result = await svc.chunk_text("The cats are running.", "en")
    word_lemmas = [c.lemma for c in _word_chunks(result)]
    assert "run" in word_lemmas, f"Expected 'run' in lemmas, got {word_lemmas}"
    assert "cat" in word_lemmas, f"Expected 'cat' in lemmas, got {word_lemmas}"


@pytest.mark.asyncio
async def test_nlp_english_pos_tagging():
    """Nouns and verbs should have readable POS labels."""
    svc = SpacyNLPService()
    result = await svc.chunk_text("Dogs bark loudly.", "en")
    words = _word_chunks(result)
    pos_values = {c.text.lower(): c.pos for c in words if c.pos}
    # 'dogs' → noun (or proper noun); 'bark' → verb
    assert any(p in ("noun", "proper noun") for p in pos_values.values()), pos_values
    assert any(p == "verb" for p in pos_values.values()), pos_values


@pytest.mark.asyncio
async def test_nlp_english_punctuation_not_selectable():
    """Punctuation tokens must have is_selectable=False."""
    svc = SpacyNLPService()
    result = await svc.chunk_text("Hello, world!", "en")
    punct_chunks = [c for c in result.chunks if c.text in (",", "!", ".")]
    assert all(not c.is_selectable for c in punct_chunks), punct_chunks


@pytest.mark.asyncio
async def test_nlp_english_multisentence():
    """Multi-sentence text is chunked without losing content."""
    svc = SpacyNLPService()
    text = "She sells seashells. He ran away quickly."
    result = await svc.chunk_text(text, "en")
    assert _reconstructed(result) == text
    assert len(_word_chunks(result)) >= 6


# ---------------------------------------------------------------------------
# Phrasal-verb postprocessing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nlp_phrasal_verb_merge():
    """Phrasal verbs returned by the LLM mock should be merged into one chunk."""
    svc = SpacyNLPService()

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value='["get off", "look after"]')

    text = "He decided to get off the train."
    result = await svc.chunk_text(text, "en", llm=mock_llm)

    # Text must still reconstruct perfectly after merging
    assert _reconstructed(result) == text

    # "get off" should appear as a single merged phrase chunk
    phrase_chunks = [c for c in result.chunks if c.pos == "phrase"]
    phrase_texts = [c.text for c in phrase_chunks]
    assert "get off" in phrase_texts, f"Expected 'get off' merged, got phrases: {phrase_texts}"


@pytest.mark.asyncio
async def test_nlp_phrasal_verb_no_postprocessing_for_non_germanic():
    """For languages outside PHRASAL_VERB_LANGS (e.g. 'fr'), the LLM should not be called."""
    svc = SpacyNLPService()

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value="[]")

    text = "Il mange une pomme."
    result = await svc.chunk_text(text, "fr", llm=mock_llm)

    # complete() must NOT have been called for French
    mock_llm.complete.assert_not_called()
    assert _reconstructed(result) == text


@pytest.mark.asyncio
async def test_nlp_phrasal_verb_llm_failure_graceful():
    """If the LLM call for phrasal verb detection raises, chunks are still returned."""
    svc = SpacyNLPService()

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM offline"))

    text = "She picked up the book."
    result = await svc.chunk_text(text, "en", llm=mock_llm)
    # Should still return valid chunks even with LLM failure
    assert _reconstructed(result) == text
    assert len(_word_chunks(result)) >= 3


# ---------------------------------------------------------------------------
# Fallback tokeniser (unknown language)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_nlp_fallback_unknown_language():
    """For an unrecognised language, fallback whitespace split is used."""
    svc = SpacyNLPService()
    text = "Merhaba dünya nasılsın"   # Turkish — no model registered
    result = await svc.chunk_text(text, "tr")
    assert _reconstructed(result) == text
    words = _word_chunks(result)
    assert len(words) == 3
    # Lemmas should be lowercased surface forms
    assert all(c.lemma == c.text.lower() for c in words)


# ---------------------------------------------------------------------------
# PHRASAL_VERB_LANGS set
# ---------------------------------------------------------------------------


def test_phrasal_verb_langs_contains_expected():
    assert "en" in PHRASAL_VERB_LANGS
    assert "nl" in PHRASAL_VERB_LANGS
    assert "de" in PHRASAL_VERB_LANGS
    assert "fr" not in PHRASAL_VERB_LANGS
    assert "ru" not in PHRASAL_VERB_LANGS


# ---------------------------------------------------------------------------
# Metadata Extraction & Enrichment
# ---------------------------------------------------------------------------


def test_extract_word_metadata_dutch_nouns():
    svc = SpacyNLPService()
    
    # Common gender noun
    m_koning = svc.extract_word_metadata("koning", "nl")
    assert m_koning["lemma"] == "koning"
    assert m_koning["pos"] == "NOUN"
    assert m_koning["gender"] == "de"

    # Neuter gender noun
    m_huis = svc.extract_word_metadata("huis", "nl")
    assert m_huis["lemma"] == "huis"
    assert m_huis["pos"] == "NOUN"
    assert m_huis["gender"] == "het"

    # Plural noun (lemma inquiry gives singular gender)
    m_vogels = svc.extract_word_metadata("vogels", "nl")
    assert m_vogels["lemma"] == "vogel"
    assert m_vogels["pos"] == "NOUN"
    assert m_vogels["gender"] == "de"


def test_extract_word_metadata_dutch_verbs():
    svc = SpacyNLPService()
    
    # Strong / irregular verb
    m_vonden = svc.extract_word_metadata("vonden", "nl", context="Zij vonden het brood.")
    assert m_vonden["lemma"] == "vinden"
    assert m_vonden["pos"] == "VERB"
    assert m_vonden["is_irregular"] is True

    # Regular weak verb
    m_werkte = svc.extract_word_metadata("werkte", "nl", context="Hij werkte de hele dag.")
    assert m_werkte["lemma"] == "werken"
    assert m_werkte["pos"] == "VERB"
    assert m_werkte["is_irregular"] is False


def test_extract_word_metadata_multiword_phrase():
    svc = SpacyNLPService()
    m_phrase = svc.extract_word_metadata("een einde maken aan", "nl")
    assert m_phrase["lemma"] == "een einde maken aan"
    assert m_phrase["pos"] == "VERB"


def test_enrich_vocabulary():
    from app.schemas.word import WordBase

    svc = SpacyNLPService()
    words = [
        WordBase(text="vogels"),
        WordBase(text="vonden"),
    ]
    enriched = svc.enrich_vocabulary(words, language_code="nl", context="De vogels vonden brood.")
    assert enriched[0].lemma == "vogel"
    assert enriched[0].gender == "de"
    assert enriched[1].lemma == "vinden"
    assert enriched[1].is_irregular is True

