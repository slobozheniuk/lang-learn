from collections.abc import Callable
import logging
import re
from typing import Any

from app.schemas.ilya_frank import IlyaFrankExcerpt, IlyaFrankResponse
from app.schemas.word import WordBase
from app.services.ilya_frank import format_canonical_frank_gloss, segment_text_into_excerpts
from app.services.llm.base import (
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
            "get off": ("сойти, выйти", "phrase", "/ɡet ɒf/", "He decided to get off the train."),
            "pick up": ("подобрать, забрать", "phrase", "/pɪk ʌp/", "Can you pick up the phone?"),
            "look after": ("присматривать за", "phrase", "/lʊk ˈɑːf.tər/", "She will look after the children."),
            "give up": ("сдаваться, бросать", "phrase", "/ɡɪv ʌp/", "Never give up on your dreams."),
            "enlightenment": ("просветление, озарение", "noun", "/ɪnˈlaɪ.tən.mənt/", "He experienced a sudden moment of enlightenment."),
            "practice": ("практика", "noun", "/ˈpræk.tɪs/", "Practice makes perfect."),
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

    # Common English phrasal / separable verbs used in mock detection
    KNOWN_PHRASAL_VERBS: list[str] = [
        "look forward to", "run out of", "put up with", "take care of", "in order to",
        "get along with", "come across", "break down", "carry on", "find out",
        "set off", "put off", "get off", "pick up", "look after", "give up",
        "wake up", "turn off", "turn on", "take off", "show up", "call off",
        "fall apart", "get along", "give in", "pass away", "run into", "stand out",
        "take after", "warm up", "turn out", "point out", "bring up", "work out",
        "figure out", "catch up", "check in", "check out",
    ]

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
        """Deterministic mock response for send_message.

        Handles phrasal-verb detection prompts by scanning KNOWN_PHRASAL_VERBS,
        or returns a deterministic text response.
        """
        import json as _json

        if user_content is None:
            if prompt is not None:
                user_content = prompt
            else:
                user_content = system_prompt or ""
                system_prompt = None

        combined = f"{(system_prompt or '').lower()}\n{(user_content or '').lower()}"

        if "phrasal verb" in combined or "separable verb" in combined:
            text_section = ""
            if "Text:\n" in user_content:
                text_section = user_content.split("Text:\n", 1)[1].strip()
            else:
                text_section = user_content

            text_lower = text_section.lower()
            found: list[str] = []
            for phrase in sorted(self.KNOWN_PHRASAL_VERBS, key=len, reverse=True):
                if phrase in text_lower:
                    idx = text_lower.find(phrase)
                    surface = text_section[idx: idx + len(phrase)]
                    found.append(surface)
            return _json.dumps(found)

        return f"Mock response for prompt: {user_content[:50]}"

    async def complete(self, prompt: str, system_prompt: str | None = None) -> str:
        """Minimal completion delegating to send_message."""
        return await self.send_message(system_prompt=system_prompt, user_content=prompt)

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

        # 2. Tokenize raw text by words
        # Clean punctuation except apostrophes
        tokens = re.findall(r"\b[\w'-]+\b", cleaned)
        if not tokens:
            tokens = [cleaned]

        seen_words = set()
        for token in tokens:
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

        title = f"Lesson: {tokens[0]}" if len(tokens) > 0 else "Extracted Vocabulary"
        if len(tokens) > 3:
            title = f"Lesson: {' '.join(tokens[:3])}..."

        return LLMTranslationResponse(
            title=title,
            items=items,
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

    @classmethod
    def _lookup(cls, word: str, lang: str) -> tuple | None:
        lang_dict = cls.DICTIONARY.get(lang.lower(), {})
        return lang_dict.get(word.lower())

    @classmethod
    def generate_mock_adaptation(
        cls,
        text: str,
        selected_words: list[str],
        source_lang: str,
        target_lang: str,
        dictionary_lookup: Callable[[str, str], tuple | None] | None = None,
    ) -> IlyaFrankResponse:
        """Deterministic rule-based Frank adaptation generator for testing and offline modes.

        Guarantees:
        - 100% adherence to Rule 1 (Ai -> Ui pairing), Rule 2 (excerpt sizing), Rule 3 (punctuation invariant),
          Rule 18 (intra-chunk non-redundancy).
        - Exact fidelity: strip_glosses(Ai) == Ui.
        """
        effective_text = (text or "").strip()
        if not effective_text:
            effective_text = ", ".join(selected_words) if selected_words else "Vocabulary practice."

        lookup = dictionary_lookup or cls._lookup
        raw_excerpts = segment_text_into_excerpts(effective_text)
        result_excerpts: list[IlyaFrankExcerpt] = []

        # Track occurrences across the entire text to support Rule 14 & Rule 15 (only initial 2-3 occurrences)
        global_word_counts: dict[str, int] = {}

        for exc_idx, raw_excerpt in enumerate(raw_excerpts, start=1):
            adapted = raw_excerpt
            extracted_vocab: list[WordBase] = []
            glossed_in_excerpt: set[str] = set()

            # Sort selected words by length descending to match multi-word collocations first
            normalized_targets = sorted(
                [w.strip() for w in selected_words if w.strip()],
                key=len,
                reverse=True,
            )

            for target in normalized_targets:
                target_clean = target.lower()
                if target_clean in glossed_in_excerpt:
                    continue

                # Look up word information
                dict_info = lookup(target_clean, target_lang) if lookup else None
                translation = dict_info[0] if dict_info else f"перевод_{target}"
                pos = dict_info[1] if dict_info else ("phrase" if " " in target else "noun")
                phonetic = dict_info[2] if dict_info else None
                lemma = target_clean

                # Determine gender annotation (Dutch het/de or Slavic m/f)
                gender = None
                if target_lang == "nl":
                    if target_clean in {"huis", "boek", "woord", "kind", "water"}:
                        gender = "het"
                    elif pos == "noun":
                        gender = "de"

                # Check frequency for Rule 14/15
                current_count = global_word_counts.get(target_clean, 0)
                show_morphology = current_count < 3
                global_word_counts[target_clean] = current_count + 1

                # Format gloss using Frank canonical notation
                rule_style = 7 if (exc_idx % 2 == 1 and len(target_clean) > 5) else 8
                literal = f"lit_{target}" if rule_style in (7, 8) else None

                gloss = format_canonical_frank_gloss(
                    surface_word=target,
                    translation=translation,
                    lemma=lemma if show_morphology else None,
                    pos=pos,
                    gender=gender if show_morphology else None,
                    literal=literal,
                    rule_style=rule_style,
                )

                # Insert gloss immediately after the word and BEFORE trailing punctuation (Rule 3)
                # Find the FIRST occurrence in this excerpt (Rule 18 non-redundancy)
                pattern = re.compile(
                    r"\b(" + re.escape(target) + r")([.,!?;:…—–]?)",
                    re.IGNORECASE,
                )
                match = pattern.search(adapted)
                if match:
                    matched_word = match.group(1)
                    trailing_punct = match.group(2) or ""
                    # Replace only first occurrence
                    replacement = f"{matched_word} {gloss}{trailing_punct}"
                    adapted = adapted[: match.start()] + replacement + adapted[match.end() :]
                    glossed_in_excerpt.add(target_clean)

                    extracted_vocab.append(
                        WordBase(
                            language_code=target_lang,
                            text=matched_word,
                            lemma=lemma,
                            pos=pos,
                            phonetic=phonetic,
                            translation=translation,
                            literal_translation=literal,
                            literary_translation=translation,
                            gender=gender,
                            is_irregular=False,
                        )
                    )

            result_excerpts.append(
                IlyaFrankExcerpt(
                    index=exc_idx,
                    adapted_text=adapted,
                    raw_text=raw_excerpt,
                    vocabulary_extracted=extracted_vocab,
                )
            )

        return IlyaFrankResponse(excerpts=result_excerpts)

    async def generate_ilya_frank(
        self,
        text: str,
        selected_words: list[str],
        source_lang: str,
        target_lang: str,
    ) -> IlyaFrankResponse:
        return self.generate_mock_adaptation(
            text=text,
            selected_words=selected_words,
            source_lang=source_lang,
            target_lang=target_lang,
        )
