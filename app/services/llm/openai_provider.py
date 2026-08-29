import json
import logging
import re
import time
from typing import Any
import httpx
from pydantic import ValidationError

from app.services.llm.base import (
    LLMProvider,
    LLMQuizQuestion,
    LLMQuizResponse,
    LLMTranslationResponse,
)

logger = logging.getLogger(__name__)


LANGUAGE_NAMES: dict[str, str] = {
    "ru": "Russian",
    "en": "English",
    "nl": "Dutch",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "tr": "Turkish",
    "pl": "Polish",
    "uk": "Ukrainian",
}


def get_language_display(code: str) -> str:
    cleaned = code.lower().strip() if code else ""
    name = LANGUAGE_NAMES.get(cleaned)
    return f"{name} ({cleaned})" if name else code


class OpenAILikeProvider(LLMProvider):
    """OpenAI-compatible LLM Provider (supporting Nous Portal, OpenRouter, Gemini Flash 3.7, etc.)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://inference-api.nousresearch.com/v1",
        model: str = "google/gemini-3.7-flash",
        timeout_seconds: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def build_system_prompt(source_lang: str, target_lang: str) -> str:
        src_label = get_language_display(source_lang)
        tgt_label = get_language_display(target_lang)

        return (
            f"You are an expert computational lexicographer, translator, and language teacher. "
            f"Your task is to analyze the input text, extract vocabulary units (words, idioms, collocations), "
            f"and generate high-quality language learning flashcards and lessons tailored to the user's language profile settings.\n\n"
            f"User Profile Language Pair:\n"
            f"- Native language: {src_label}\n"
            f"- Learning (target) language: {tgt_label}\n\n"
            f"Translation and Enrichment Instructions:\n"
            f"1. You MUST specifically translate between the user's learning (target) language ({tgt_label}) and native language ({src_label}).\n"
            f"2. For each extracted vocabulary unit:\n"
            f"   - 'target_text': The word, idiom, or collocation in the user's learning (target) language ({tgt_label}).\n"
            f"   - 'source_text': The accurate translation and definition in the user's native language ({src_label}).\n"
            f"   - 'pos': Part of speech (e.g., noun, verb, adjective, adverb, phrase, etc.).\n"
            f"   - 'phonetic': Accurate IPA phonetic transcription for the learning language word ('target_text').\n"
            f"   - 'lemma': Dictionary base form of 'target_text' in {tgt_label}.\n"
            f"   - 'context_phrase': A natural, clear example sentence in the learning language ({tgt_label}) demonstrating 'target_text' in context.\n"
            f"3. Provide a concise, descriptive 'title' summarizing the lesson or vocabulary theme.\n\n"
            f"Output MUST be strict JSON in this format:\n"
            f'{{"title": "Lesson title", "items": [{{"source_text": "...", "target_text": "...", "pos": "...", "phonetic": "...", "lemma": "...", "context_phrase": "..."}}]}}\n'
            f"Return ONLY valid JSON."
        )

    @staticmethod
    def build_quiz_system_prompt(source_lang: str, target_lang: str) -> str:
        src_label = get_language_display(source_lang)
        tgt_label = get_language_display(target_lang)

        return (
            f"You are an expert language teacher and quiz author for students learning {tgt_label} (native language: {src_label}).\n"
            f"Your task is to generate high-quality multiple-choice quiz questions to test and consolidate the student's vocabulary and comprehension.\n\n"
            f"Requirements:\n"
            f"1. Generate multiple-choice quiz questions based on the provided vocabulary words or text.\n"
            f"2. Each question MUST contain:\n"
            f"   - 'question': Clear question prompt testing word meaning, contextual fill-in-the-blank, or translation\n"
            f"   - 'options': An array of EXACTLY 4 distinct multiple-choice option strings\n"
            f"   - 'correct_index': The 0-based integer index (0, 1, 2, or 3) of the correct answer in the 'options' array\n"
            f"   - 'explanation': A helpful explanation explaining why the answer is correct\n"
            f"3. Provide a concise, descriptive 'title' for the quiz lesson.\n\n"
            f"Output MUST be strict JSON in this format:\n"
            f'{{\n'
            f'  "title": "Lesson Title",\n'
            f'  "questions": [\n'
            f'    {{\n'
            f'      "question": "Question text...",\n'
            f'      "options": ["Option A", "Option B", "Option C", "Option D"],\n'
            f'      "correct_index": 0,\n'
            f'      "explanation": "Explanation..."\n'
            f'    }}\n'
            f'  ]\n'
            f'}}\n'
            f"Return ONLY valid JSON."
        )

    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }

        start_time = time.perf_counter()
        logger.info(
            f"External LLM API Request [complete]: model='{self.model}', base_url='{self.base_url}', "
            f"prompt_length={len(prompt)}"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                duration_ms = (time.perf_counter() - start_time) * 1000
                usage = data.get("usage", {})
                logger.info(
                    f"External LLM API Response [complete]: model='{self.model}', status={resp.status_code}, "
                    f"duration={duration_ms:.2f}ms, prompt_tokens={usage.get('prompt_tokens', 'N/A')}, "
                    f"completion_tokens={usage.get('completion_tokens', 'N/A')}, total_tokens={usage.get('total_tokens', 'N/A')}"
                )
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"External LLM API Error [complete]: model='{self.model}', duration={duration_ms:.2f}ms, error='{e}'",
                exc_info=True,
            )
            raise

    async def extract_vocabulary(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> LLMTranslationResponse:
        system_prompt = self.build_system_prompt(source_lang=source_lang, target_lang=target_lang)
        user_content = f"Input Text to process:\n{text.strip()}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        start_time = time.perf_counter()
        logger.info(
            f"External LLM API Request [extract_vocabulary]: model='{self.model}', base_url='{self.base_url}', "
            f"pair='{source_lang}->{target_lang}', text_preview='{text[:40].strip()}...', length={len(text)}"
        )

        raw_content = ""
        # Try request with JSON mode, fallback if response_format unsupported
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                raw_content = data["choices"][0]["message"]["content"]
                duration_ms = (time.perf_counter() - start_time) * 1000
                usage = data.get("usage", {})
                logger.info(
                    f"External LLM API Response [extract_vocabulary]: model='{self.model}', status={resp.status_code}, "
                    f"duration={duration_ms:.2f}ms, prompt_tokens={usage.get('prompt_tokens', 'N/A')}, "
                    f"completion_tokens={usage.get('completion_tokens', 'N/A')}, total_tokens={usage.get('total_tokens', 'N/A')}"
                )
            except httpx.HTTPStatusError as e:
                # If 400 with response_format issue, retry without response_format
                if payload.get("response_format"):
                    logger.warning(f"LLM json response_format unsupported by endpoint; retrying standard request: {e}")
                    payload.pop("response_format", None)
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"]
                    duration_ms = (time.perf_counter() - start_time) * 1000
                    usage = data.get("usage", {})
                    logger.info(
                        f"External LLM API Response (retry) [extract_vocabulary]: model='{self.model}', status={resp.status_code}, "
                        f"duration={duration_ms:.2f}ms, prompt_tokens={usage.get('prompt_tokens', 'N/A')}, "
                        f"completion_tokens={usage.get('completion_tokens', 'N/A')}"
                    )
                else:
                    duration_ms = (time.perf_counter() - start_time) * 1000
                    logger.error(
                        f"External LLM API HTTP Error: model='{self.model}', status={e.response.status_code}, duration={duration_ms:.2f}ms, response={e.response.text[:200]}",
                        exc_info=True,
                    )
                    raise
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.error(
                    f"External LLM API Communication Error: model='{self.model}', duration={duration_ms:.2f}ms, error='{e}'",
                    exc_info=True,
                )
                raise

        parsed_response = self._parse_and_validate(raw_content, text)
        logger.info(
            f"LLM response parsed successfully: extracted {len(parsed_response.items)} items, title='{parsed_response.title}'"
        )
        return parsed_response

    async def generate_quiz(
        self,
        words: list[dict[str, Any]],
        source_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        system_prompt = self.build_quiz_system_prompt(source_lang=source_lang, target_lang=target_lang)

        words_summary = "\n".join(
            f"- {w.get('text', '')}: {w.get('translation', '')} (pos: {w.get('pos', '')}, example: {w.get('context_phrase', '')})"
            for w in words
        )
        user_content = (
            f"Title context: {title or 'Vocabulary Quiz'}\n"
            f"Vocabulary list to test:\n{words_summary}\n"
        )
        if text:
            user_content += f"\nSource text context:\n{text.strip()}\n"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        }

        start_time = time.perf_counter()
        logger.info(
            f"External LLM API Request [generate_quiz]: model='{self.model}', words_count={len(words)}"
        )

        raw_content = ""
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                raw_content = data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if payload.get("response_format"):
                    payload.pop("response_format", None)
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"]
                else:
                    raise

        parsed_quiz = self._parse_and_validate_quiz(raw_content)
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"LLM Quiz generated successfully: {len(parsed_quiz.questions)} questions, duration={duration_ms:.2f}ms"
        )
        return parsed_quiz

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
        normalized_words: list[dict[str, Any]] = []
        for w in words:
            if isinstance(w, dict):
                normalized_words.append(w)
            elif isinstance(w, str):
                normalized_words.append({"text": w, "translation": w})
            elif hasattr(w, "text"):
                normalized_words.append({
                    "text": getattr(w, "text", ""),
                    "translation": getattr(w, "translation", ""),
                    "pos": getattr(w, "pos", None),
                    "phonetic": getattr(w, "phonetic", None),
                    "context_phrase": getattr(w, "context_phrase", None),
                })
            else:
                normalized_words.append({"text": str(w)})

        return await self.generate_quiz(
            words=normalized_words,
            source_lang=native_lang,
            target_lang=target_lang,
            text=text,
            title=title,
        )

    def _parse_and_validate(self, raw_content: str, original_text: str) -> LLMTranslationResponse:
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            parsed_json = json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.warning(f"Failed to decode JSON from LLM: {err}. Raw content: {raw_content[:200]}")
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                parsed_json = json.loads(match.group(0))
            else:
                raise ValueError(f"LLM returned invalid non-JSON output: {raw_content[:200]}") from err

        try:
            return LLMTranslationResponse.model_validate(parsed_json)
        except ValidationError:
            if isinstance(parsed_json, list):
                return LLMTranslationResponse.model_validate({"items": parsed_json})
            raise

    def _parse_and_validate_quiz(self, raw_content: str) -> LLMQuizResponse:
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            parsed_json = json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.warning(f"Failed to decode Quiz JSON from LLM: {err}. Raw content: {raw_content[:200]}")
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                parsed_json = json.loads(match.group(0))
            else:
                raise ValueError(f"LLM returned invalid non-JSON quiz output: {raw_content[:200]}") from err

        try:
            return LLMQuizResponse.model_validate(parsed_json)
        except ValidationError:
            if isinstance(parsed_json, list):
                return LLMQuizResponse.model_validate({"title": "Generated Quiz", "questions": parsed_json})
            raise
