"""spaCy-based NLP service for text chunking, lemmatization, and POS tagging.

Pipeline per chunk_text() call:
  1. Load large spaCy model for the target language (lazy-cached).
  2. Tokenise with spaCy → LLMChunkItem list (lemma, pos, is_selectable).
  3. Phrasal-verb postprocessing for Germanic languages:
     a lightweight LLM prompt returns a JSON array of phrasal verbs
     found in the text; matching consecutive word-chunks are merged.
"""

from __future__ import annotations

import json
import logging
import re
import subprocess
import sys
from typing import Any, TYPE_CHECKING

from app.services.llm.base import LLMChunkItem, LLMChunkResponse

if TYPE_CHECKING:
    from app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Model registry
# ──────────────────────────────────────────────────────────────────────────────

#: Languages that commonly have separable / phrasal verbs and benefit from
#: postprocessing.
PHRASAL_VERB_LANGS: set[str] = {"en", "de", "nl", "sv", "da", "no"}

#: Language-code → spaCy model name (large variants).
SPACY_MODEL_MAP: dict[str, str] = {
    "en": "en_core_web_lg",
    "de": "de_core_news_lg",
    "nl": "nl_core_news_lg",
    "fr": "fr_core_news_lg",
    "es": "es_core_news_lg",
    "it": "it_core_news_lg",
    "pt": "pt_core_news_lg",
    "ru": "ru_core_news_lg",
    "pl": "pl_core_news_lg",
    "uk": "uk_core_news_lg",
    "zh": "zh_core_web_lg",
    "ja": "ja_core_news_lg",
}

#: spaCy POS tag (Universal Dependencies) → human-readable label.
_POS_MAP: dict[str, str] = {
    "ADJ": "adjective",
    "ADP": "preposition",
    "ADV": "adverb",
    "AUX": "auxiliary",
    "CCONJ": "conjunction",
    "DET": "determiner",
    "INTJ": "interjection",
    "NOUN": "noun",
    "NUM": "numeral",
    "PART": "particle",
    "PRON": "pronoun",
    "PROPN": "proper noun",
    "PUNCT": "punctuation",
    "SCONJ": "conjunction",
    "SYM": "symbol",
    "VERB": "verb",
    "X": "other",
    "SPACE": "space",
}

# ──────────────────────────────────────────────────────────────────────────────
# Service
# ──────────────────────────────────────────────────────────────────────────────


class SpacyNLPService:
    """Singleton NLP service wrapping spaCy large language models."""

    def __init__(self) -> None:
        self._models: dict[str, object] = {}  # lang_code → spacy.Language

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_model(self, language_code: str) -> object | None:
        """Return a cached spaCy model for *language_code*, downloading if needed."""
        lang = language_code.lower().strip()
        if lang in self._models:
            return self._models[lang]

        model_name = SPACY_MODEL_MAP.get(lang)
        if not model_name:
            logger.warning(
                f"No spaCy model registered for language '{lang}'. "
                "Falling back to whitespace split."
            )
            self._models[lang] = None
            return None

        try:
            import spacy  # noqa: PLC0415
            nlp = spacy.load(model_name)
            self._models[lang] = nlp
            logger.info(f"Loaded spaCy model '{model_name}' for language '{lang}'.")
            return nlp
        except OSError:
            logger.info(
                f"spaCy model '{model_name}' not found locally. Attempting download..."
            )
            try:
                subprocess.run(
                    [sys.executable, "-m", "spacy", "download", model_name],
                    check=True,
                    capture_output=True,
                )
                import spacy  # noqa: PLC0415
                nlp = spacy.load(model_name)
                self._models[lang] = nlp
                logger.info(
                    f"Downloaded and loaded spaCy model '{model_name}' for '{lang}'."
                )
                return nlp
            except Exception as exc:
                logger.warning(
                    f"Could not download spaCy model '{model_name}': {exc}. "
                    "Falling back to whitespace split."
                )
                self._models[lang] = None
                return None

    # ------------------------------------------------------------------
    # Tokenisation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_chunks(text: str) -> list[LLMChunkItem]:
        """Whitespace-based fallback tokeniser when no spaCy model is available."""
        chunks: list[LLMChunkItem] = []
        parts = re.split(r"(\s+)", text)
        idx = 0
        for part in parts:
            if not part:
                continue
            is_space = bool(re.fullmatch(r"\s+", part))
            is_punct = bool(re.fullmatch(r"[^\w\s]+", part)) and not is_space
            selectable = not is_space and not is_punct
            chunks.append(
                LLMChunkItem(
                    id=idx,
                    text=part,
                    is_selectable=selectable,
                    is_word=selectable,
                    lemma=part.lower() if selectable else None,
                    pos=None,
                )
            )
            idx += 1
        return chunks

    @staticmethod
    def _spacy_chunks(nlp: object, text: str) -> list[LLMChunkItem]:
        """Run spaCy on *text* and build a chunk list that reconstructs the original."""
        doc = nlp(text)  # type: ignore[operator]
        chunks: list[LLMChunkItem] = []
        idx = 0
        cursor = 0

        for token in doc:
            # Preserve any whitespace before this token
            if token.idx > cursor:
                gap = text[cursor : token.idx]
                chunks.append(
                    LLMChunkItem(
                        id=idx,
                        text=gap,
                        is_selectable=False,
                        is_word=False,
                    )
                )
                idx += 1

            pos_tag = token.pos_
            selectable = pos_tag not in ("PUNCT", "SPACE", "SYM", "X", "")
            human_pos = _POS_MAP.get(pos_tag, pos_tag.lower() if pos_tag else None)

            chunks.append(
                LLMChunkItem(
                    id=idx,
                    text=token.text,
                    is_selectable=selectable,
                    is_word=selectable,
                    lemma=token.lemma_.lower() if selectable else None,
                    pos=human_pos if selectable else None,
                )
            )
            idx += 1
            cursor = token.idx + len(token.text)

        # Trailing text
        if cursor < len(text):
            chunks.append(
                LLMChunkItem(
                    id=idx,
                    text=text[cursor:],
                    is_selectable=False,
                    is_word=False,
                )
            )

        return chunks

    # ------------------------------------------------------------------
    # Phrasal-verb postprocessing
    # ------------------------------------------------------------------

    @staticmethod
    def _build_phrasal_verb_prompt(text: str, language_code: str) -> str:
        return (
            f"You are a computational linguist specialising in {language_code} phrasal verbs and separable verbs.\n"
            f"List ALL phrasal verbs / separable verb collocations that appear in the text below.\n"
            f"Rules:\n"
            f"- Return ONLY a JSON array of strings, e.g. [\"get off\", \"look after\"]\n"
            f"- Each string must be exactly as it appears in the text (preserve case).\n"
            f"- If there are none, return an empty array: []\n"
            f"- Return ONLY the JSON array, no other text.\n\n"
            f"Text:\n{text.strip()}"
        )

    async def _detect_phrasal_verbs(
        self, text: str, language_code: str, llm: "LLMProvider"
    ) -> list[str]:
        """Call the LLM with a lightweight prompt; return list of phrasal verb strings."""
        prompt = self._build_phrasal_verb_prompt(text, language_code)
        try:
            raw = await llm.complete(prompt)
            raw = raw.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
            raw = re.sub(r"\s*```$", "", raw)
            result = json.loads(raw)
            if isinstance(result, list):
                return [str(p) for p in result if p]
            return []
        except Exception as exc:
            logger.warning(f"Phrasal verb detection failed: {exc}")
            return []

    @staticmethod
    def _merge_phrasal_verbs(
        chunks: list[LLMChunkItem], phrasal_verbs: list[str]
    ) -> list[LLMChunkItem]:
        """Merge consecutive word-chunks that together form a phrasal verb.

        Whitespace chunks between two word tokens of the phrase are absorbed
        into the merged chunk.  The merged chunk keeps the combined original
        surface text and gets pos='phrase'.
        """
        if not phrasal_verbs:
            return chunks

        sorted_phrases = sorted(phrasal_verbs, key=len, reverse=True)

        result = list(chunks)
        for phrase in sorted_phrases:
            phrase_lower = phrase.lower()
            i = 0
            while i < len(result):
                j = i
                span_text = ""

                while j < len(result):
                    chunk = result[j]
                    span_text_candidate = span_text + chunk.text
                    span_text_lower = span_text_candidate.lower()

                    if phrase_lower == span_text_lower:
                        merged_text = "".join(result[k].text for k in range(i, j + 1))
                        merged = LLMChunkItem(
                            id=result[i].id,
                            text=merged_text,
                            is_selectable=True,
                            is_word=True,
                            lemma=phrase.lower(),
                            pos="phrase",
                        )
                        result = result[:i] + [merged] + result[j + 1 :]
                        break
                    elif phrase_lower.startswith(span_text_lower):
                        span_text = span_text_candidate
                        j += 1
                    else:
                        break

                i += 1

        for k, chunk in enumerate(result):
            chunk.id = k
        return result

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def chunk_text(
        self,
        text: str,
        language_code: str,
        llm: "LLMProvider | None" = None,
    ) -> LLMChunkResponse:
        """Tokenise *text* with spaCy and optionally merge phrasal verbs.

        Args:
            text: Raw input text.
            language_code: ISO 639-1 code of the *target* language.
            llm: Optional LLMProvider for phrasal-verb postprocessing.
                 Skipped if None or if language is not in PHRASAL_VERB_LANGS.

        Returns:
            LLMChunkResponse with raw_text preserved and chunks filled.
        """
        if not text or not text.strip():
            return LLMChunkResponse(title=None, chunks=[], raw_text=text)

        lang = language_code.lower().strip()
        nlp = self._load_model(lang)

        if nlp is None:
            chunks = self._fallback_chunks(text)
        else:
            chunks = self._spacy_chunks(nlp, text)

        if llm is not None and lang in PHRASAL_VERB_LANGS:
            phrasal_verbs = await self._detect_phrasal_verbs(text, lang, llm)
            if phrasal_verbs:
                logger.info(
                    f"NLP postprocessing: merging {len(phrasal_verbs)} phrasal verb(s): {phrasal_verbs}"
                )
                chunks = self._merge_phrasal_verbs(chunks, phrasal_verbs)

        return LLMChunkResponse(title=None, chunks=chunks, raw_text=text)

    # ------------------------------------------------------------------
    # Morphological & Metadata Extraction
    # ------------------------------------------------------------------

    @staticmethod
    def _infer_gender(token: Any, nlp: Any, lang: str) -> str | None:
        """Infer grammatical gender (e.g. Dutch 'de'/'het' or Romance/Germanic 'm'/'f'/'n')."""
        if token.pos_ not in ("NOUN", "PROPN"):
            return None

        genders = token.morph.get("Gender")
        if not genders and token.lemma_:
            # For plural nouns or forms where gender is absent on inflected token, query lemma
            lemma_doc = nlp(token.lemma_)
            if len(lemma_doc) > 0:
                genders = lemma_doc[0].morph.get("Gender")

        if not genders:
            return None

        g = genders[0]
        if lang == "nl":
            return "het" if g == "Neut" else ("de" if g == "Com" else g)
        return {"Masc": "m", "Fem": "f", "Neut": "n"}.get(g, g.lower())

    @staticmethod
    def _is_verb_irregular(text: str, lemma: str, morph: dict[str, str], lang: str) -> bool:
        """Check if verb inflection represents a strong / irregular form."""
        t_low = text.lower()
        l_low = lemma.lower()
        if lang == "nl":
            if morph.get("Tense") == "Past" or morph.get("VerbForm") == "Part":
                stem = l_low[:-2] if l_low.endswith("en") else (l_low[:-1] if l_low.endswith("n") else l_low)
                if not t_low.startswith(stem[:max(2, len(stem) - 1)]):
                    return True
                if morph.get("Tense") == "Past" and not t_low.endswith(("de", "den", "te", "ten")):
                    return True
            return False
        if lang == "en":
            if morph.get("Tense") == "Past" or morph.get("VerbForm") == "Part":
                if not t_low.endswith(("ed", "d")) or l_low not in t_low:
                    return True
            return False
        return False

    def extract_word_metadata(
        self,
        text: str,
        language_code: str,
        context: str | None = None,
    ) -> dict[str, Any]:
        """Extract lemma, POS, gender, and morphological features using spaCy."""
        clean_text = text.strip().strip(".,!?:;\"'()«»")
        lang = language_code.lower().strip()
        nlp = self._load_model(lang)

        fallback: dict[str, Any] = {
            "text": clean_text,
            "lemma": clean_text.lower(),
            "pos": "phrase" if " " in clean_text else "word",
            "gender": None,
            "number": None,
            "tense": None,
            "verb_form": None,
            "is_irregular": False,
        }
        if nlp is None or not clean_text:
            return fallback

        # 1. Try to find the token within the provided authentic context for disambiguation
        target_token = None
        if context and clean_text.lower() in context.lower():
            try:
                cdoc = nlp(context)
                for t in cdoc:
                    if t.text.lower() == clean_text.lower():
                        target_token = t
                        break
            except Exception as e:
                logger.warning(f"Error parsing context for metadata extraction: {e}")

        # 2. If not found in context, process the target text directly
        if target_token is None:
            try:
                doc = nlp(clean_text)
                content_tokens = [t for t in doc if not t.is_punct and not t.is_space]
                if not content_tokens:
                    return fallback

                # Multi-word collocation / expression
                if len(content_tokens) > 1:
                    verb_tok = next((t for t in content_tokens if t.pos_ == "VERB"), None)
                    is_irreg = (
                        self._is_verb_irregular(verb_tok.text, verb_tok.lemma_, verb_tok.morph.to_dict(), lang)
                        if verb_tok
                        else False
                    )
                    return {
                        "text": clean_text,
                        "lemma": clean_text.lower(),
                        "pos": "VERB" if verb_tok else "phrase",
                        "gender": None,
                        "number": None,
                        "tense": verb_tok.morph.get("Tense")[0] if verb_tok and verb_tok.morph.get("Tense") else None,
                        "verb_form": verb_tok.morph.get("VerbForm")[0] if verb_tok and verb_tok.morph.get("VerbForm") else None,
                        "is_irregular": is_irreg,
                    }

                target_token = content_tokens[0]
            except Exception as e:
                logger.warning(f"Error extracting word metadata for '{clean_text}': {e}")
                return fallback

        morph = target_token.morph.to_dict()
        is_irreg = (
            self._is_verb_irregular(target_token.text, target_token.lemma_, morph, lang)
            if target_token.pos_ == "VERB"
            else False
        )

        return {
            "text": clean_text,
            "lemma": target_token.lemma_.lower(),
            "pos": target_token.pos_,
            "gender": self._infer_gender(target_token, nlp, lang),
            "number": morph.get("Number"),
            "tense": morph.get("Tense"),
            "verb_form": morph.get("VerbForm"),
            "is_irregular": is_irreg,
        }

    def enrich_vocabulary(
        self,
        words: list[Any],
        language_code: str,
        context: str | None = None,
    ) -> list[Any]:
        """Enrich a list of word items (dicts or Pydantic models) with spaCy metadata."""
        if not words:
            return words

        for item in words:
            surface: str | None = None
            if isinstance(item, dict):
                surface = item.get("text") or item.get("target_text") or item.get("word")
            else:
                surface = getattr(item, "text", None) or getattr(item, "target_text", None) or getattr(item, "word", None)

            if not surface:
                continue

            meta = self.extract_word_metadata(surface, language_code=language_code, context=context)

            if isinstance(item, dict):
                if not item.get("lemma"):
                    item["lemma"] = meta["lemma"]
                if not item.get("pos"):
                    item["pos"] = meta["pos"]
                if not item.get("gender") and meta.get("gender"):
                    item["gender"] = meta["gender"]
                if item.get("is_irregular") is None:
                    item["is_irregular"] = meta["is_irregular"]
            else:
                if hasattr(item, "lemma") and not getattr(item, "lemma", None):
                    setattr(item, "lemma", meta["lemma"])
                if hasattr(item, "pos") and not getattr(item, "pos", None):
                    setattr(item, "pos", meta["pos"])
                if hasattr(item, "gender") and not getattr(item, "gender", None) and meta.get("gender"):
                    setattr(item, "gender", meta["gender"])
                if hasattr(item, "is_irregular") and getattr(item, "is_irregular", None) is None:
                    setattr(item, "is_irregular", meta["is_irregular"])

        return words


# Singleton instance shared across the application
nlp_service = SpacyNLPService()
