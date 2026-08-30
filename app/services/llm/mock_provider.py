import logging
import re
from typing import Any
from app.services.llm.base import (
    LLMChunkItem,
    LLMChunkResponse,
    LLMProvider,
    LLMQuizQuestion,
    LLMQuizResponse,
    LLMTranslationResponse,
    LLMWordItem,
)

logger = logging.getLogger("app.services.llm.mock")


class MockLLMProvider(LLMProvider):
    """Deterministic mock provider for offline testing and development."""

    # Built-in mini dictionary for accurate testing
    DICTIONARY = {
        "en": {
            "hello": ("привет", "interjection", "/həˈloʊ/", "Hello, how are you?"),
            "world": ("мир", "noun", "/wɜːrld/", "Welcome to the world."),
            "apple": ("яблоко", "noun", "/ˈæp.əl/", "I ate a green apple."),
            "banana": ("банан", "noun", "/bəˈnæn.ə/", "Bananas are rich in potassium."),
            "sun": ("солнце", "noun", "/sʌn/", "The sun shines brightly."),
            "moon": ("луна", "noun", "/muːn/", "The moon is full tonight."),
            "book": ("книга", "noun", "/bʊk/", "She is reading a captivating book."),
            "house": ("дом", "noun", "/haʊs/", "They live in a cozy house."),
            "dog": ("собака", "noun", "/dɒɡ/", "The dog barked happily."),
            "cat": ("кошка", "noun", "/kæt/", "The cat purred on my lap."),
            "ephemeral": ("мимолетный", "adjective", "/ɪˈfem.ər.əl/", "Fame in the internet age is ephemeral."),
            "serendipity": ("счастливая случайность", "noun", "/ˌser.ənˈdɪp.ə.ti/", "Finding that book was pure serendipity."),
            "luminary": ("светило", "noun", "/ˈluː.mɪ.nər.i/", "She is a luminary in physics."),
            "sonder": ("осознание", "noun", "/ˈsɒn.dər/", "He felt sonder in the crowd."),
            "gezellig": ("уютный", "adjective", "/ɣəˈzɛləx/", "Het was heel gezellig."),
        },
        "ru": {
            "привет": ("hello", "interjection", "/prʲɪˈvʲet/", "Привет, как дела?"),
            "мир": ("world", "noun", "/mʲir/", "Мир прекрасен."),
            "яблоко": ("apple", "noun", "/ˈjabləkə/", "Свежее яблоко на столе."),
            "банан": ("banana", "noun", "/bɐˈnan/", "Спелый банан."),
            "солнце": ("sun", "noun", "/ˈsontsə/", "Яркое солнце."),
            "книга": ("book", "noun", "/ˈknʲiɡə/", "Интересная книга."),
            "дом": ("house", "noun", "/dom/", "Новый дом."),
            "собака": ("dog", "noun", "/sɐˈbakə/", "Верная собака."),
            "кошка": ("cat", "noun", "/ˈkoʂkə/", "Пушистая кошка."),
            "светило": ("luminary", "noun", "/svʲɪˈtʲilə/", "Великое светило."),
            "уютный": ("cozy", "adjective", "/ʊˈjutnɨj/", "Уютный вечер."),
        },
        "nl": {
            "gezellig": ("уютный", "adjective", "/ɣəˈzɛləx/", "Een heel gezellige avond."),
            "huis": ("дом", "noun", "/hœy̯s/", "Een mooi huis in Utrecht."),
            "boek": ("книга", "noun", "/buk/", "Ik lees een goed boek."),
        },
    }

    DISTRACTORS = [
        "яблоко", "книга", "дом", "собака", "солнце", "мир", "кошка", "банан", "уютный", "светило"
    ]
    DISTRACTORS_EN = [
        "apple", "book", "house", "dog", "sun", "world", "cat", "banana", "cozy", "luminary"
    ]

    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        return f"Mock response for prompt: {prompt[:50]}"

    async def extract_vocabulary(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> LLMTranslationResponse:
        cleaned = text.strip()
        items: list[LLMWordItem] = []

        # 1. Check if user typed a pair like "text - translation" or "text -> translation"
        pair_match = re.match(r"^(.+?)\s*(?:[-–—=:]|->|=>)\s*(.+)$", cleaned)
        if pair_match:
            part1 = pair_match.group(1).strip()
            part2 = pair_match.group(2).strip()

            target_text = part1
            source_text = part2

            dict_info = self._lookup(target_text, target_lang)
            pos = dict_info[1] if dict_info else "noun"
            phonetic = dict_info[2] if dict_info else f"/{target_text}/"
            context = dict_info[3] if dict_info else f"Example context for '{target_text}'."

            items.append(
                LLMWordItem(
                    source_text=source_text,
                    target_text=target_text,
                    pos=pos,
                    phonetic=phonetic,
                    lemma=target_text.lower(),
                    context_phrase=context,
                )
            )
            return LLMTranslationResponse(
                title=f"Vocabulary: {target_text}",
                items=items,
            )

        # 2. Tokenize raw text by lines or words (preserving multi-word lines or phrases)
        # Check if text is a phrase in idioms or single word or line
        lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
        if len(lines) > 1:
            candidates = lines
        elif " " in cleaned and cleaned.lower() in [
            "get off", "get on", "pick up", "look after", "give up", "run out of",
            "take care of", "in front of", "as well as", "at first", "by the way",
            "on time", "in time", "right now", "so far", "wake up", "turn on", "turn off"
        ]:
            candidates = [cleaned]
        else:
            candidates = re.findall(r"\b[\w'-]+\b", cleaned)
            if not candidates:
                candidates = [cleaned]

        seen_words = set()
        for token in candidates:
            token_clean = token.strip()
            if not token_clean or token_clean.lower() in seen_words:
                continue
            seen_words.add(token_clean.lower())

            # Look up or generate translation
            dict_info = self._lookup(token_clean.lower(), target_lang)
            if dict_info:
                trans, pos, phonetic, ctx = dict_info
                items.append(
                    LLMWordItem(
                        source_text=trans,
                        target_text=token_clean,
                        pos=pos,
                        phonetic=phonetic,
                        lemma=token_clean.lower(),
                        context_phrase=ctx,
                    )
                )
            else:
                # Reverse check
                src_dict = self._lookup(token_clean.lower(), source_lang)
                if src_dict:
                    target_w, pos, phonetic, ctx = src_dict
                    items.append(
                        LLMWordItem(
                            source_text=token_clean,
                            target_text=target_w,
                            pos=pos,
                            phonetic=phonetic,
                            lemma=target_w.lower(),
                            context_phrase=ctx,
                        )
                    )
                else:
                    # Fallback synthetic translation
                    items.append(
                        LLMWordItem(
                            source_text=f"перевод_{token_clean}",
                            target_text=token_clean,
                            pos="word",
                            phonetic=f"/{token_clean}/",
                            lemma=token_clean.lower(),
                            context_phrase=f"Usage example of '{token_clean}' in context.",
                        )
                    )

        title = f"Lesson: {candidates[0]}" if len(candidates) > 0 else "Extracted Vocabulary"
        if len(candidates) > 3:
            title = f"Lesson: {' '.join(candidates[:3])}..."

        return LLMTranslationResponse(
            title=title,
            items=items,
        )

    async def chunk_text(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> LLMChunkResponse:
        """Chunk text preserving idioms/phrases as single entities."""
        cleaned = text.strip()
        if not cleaned:
            return LLMChunkResponse(title="Text Review", chunks=[])

        # Common idioms / multi-word expressions to chunk as single entities
        idioms = [
            "get off", "get on", "pick up", "look after", "give up", "run out of",
            "take care of", "in front of", "as well as", "at first", "by the way",
            "on time", "in time", "right now", "so far", "wake up", "turn on", "turn off"
        ]
        
        # Sort idioms by length descending to match longest phrase first
        idioms.sort(key=len, reverse=True)

        # Regex matching idioms, words (including hyphens/apostrophes), whitespace, or punctuation
        idiom_patterns = [re.escape(i) for i in idioms]
        pattern = re.compile(
            r"(" + "|".join(idiom_patterns) + r"|[\w'-]+|[^\w\s]+|\s+)",
            re.IGNORECASE
        )

        chunks: list[LLMChunkItem] = []
        for match in pattern.finditer(cleaned):
            token = match.group(0)
            if not token:
                continue
            is_word_or_idiom = bool(re.search(r"\w", token))
            is_selectable = is_word_or_idiom
            chunks.append(
                LLMChunkItem(
                    text=token,
                    is_selectable=is_selectable,
                    lemma=token.lower().strip() if is_selectable else None,
                )
            )

        title = "Text Review"
        first_words = [c.text for c in chunks if c.is_selectable]
        if first_words:
            title = f"Review: {' '.join(first_words[:3])}..."

        return LLMChunkResponse(
            title=title,
            chunks=chunks,
        )

    async def generate_quiz(
        self,
        words: list[dict[str, Any]],
        source_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        word_items = list(words)
        if not word_items and text:
            extracted = await self.extract_vocabulary(text, source_lang, target_lang)
            word_items = [
                {"text": it.target_text, "translation": it.source_text, "pos": it.pos, "context_phrase": it.context_phrase}
                for it in extracted.items
            ]

        if not word_items:
            word_items = [{"text": "practice", "translation": "практика", "pos": "noun"}]

        distractor_pool = self.DISTRACTORS if source_lang == "ru" else self.DISTRACTORS_EN
        questions: list[LLMQuizQuestion] = []

        for idx, w in enumerate(word_items):
            target_word = w.get("text") or w.get("target_text") or "word"
            correct_trans = w.get("translation") or w.get("source_text") or target_word
            context = w.get("context_phrase")

            # Formulate question prompt
            if context and target_word.lower() in context.lower():
                prompt_q = f"Which word completes the phrase: '{context.replace(target_word, '_____')}'?"
                correct_ans = target_word
                # Distractors in target lang
                distractors = [d for d in self.DISTRACTORS_EN if d.lower() != target_word.lower()][:3]
                while len(distractors) < 3:
                    distractors.append(f"option_{len(distractors)+1}")
            else:
                prompt_q = f"What is the correct translation of '{target_word}'?"
                correct_ans = correct_trans
                # Distractors in source lang
                distractors = [d for d in distractor_pool if d.lower() != correct_trans.lower()][:3]
                while len(distractors) < 3:
                    distractors.append(f"перевод_вариант_{len(distractors)+1}")

            correct_idx = idx % 4
            options = list(distractors[:3])
            options.insert(correct_idx, correct_ans)

            questions.append(
                LLMQuizQuestion(
                    id=idx + 1,
                    question=prompt_q,
                    options=options,
                    correct_index=correct_idx,
                    correct_option_index=correct_idx,
                    correct_answer=correct_ans,
                    explanation=f"'{target_word}' corresponds to '{correct_trans}'.",
                    target_word=target_word,
                )
            )

        quiz_title = title or (f"Quiz: {word_items[0].get('text', 'Vocabulary')}" if word_items else "Vocabulary Quiz")
        return LLMQuizResponse(title=quiz_title, questions=questions)

    async def generate_quiz_questions(
        self,
        words: list[Any],
        native_lang: str,
        target_lang: str,
        text: str | None = None,
        title: str | None = None,
    ) -> LLMQuizResponse:
        """Deterministic mock for generating multiple choice questions."""
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

    def _lookup(self, word: str, lang: str):
        lang_dict = self.DICTIONARY.get(lang.lower(), {})
        return lang_dict.get(word.lower())
