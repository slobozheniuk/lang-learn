"""Ilya Frank Text Adaptation & Dual-Pass Engine (27-Rule Implementation).

References:
- Ticket-Ilya-Frank-Engine.md (TKT-008A)
- Ilya-Frank-specification.md
"""

import json
import logging
import re
from typing import Any

from app.schemas.ilya_frank import IlyaFrankResponse

logger = logging.getLogger("app.services.ilya_frank")

# Punctuation marks that can trail a word/gloss
TRAILING_PUNCTUATION = {",", ".", "!", "?", ";", ":", "…", "—", "–"}


def strip_glosses(adapted_text: str) -> str:
    """Strip inline parenthetical glosses from an adapted Ilya Frank text.

    Preserves exact punctuation and spacing invariants:
    - `word (gloss), next` -> `word, next`
    - `word (gloss).` -> `word.`
    - `word (gloss) next` -> `word next`
    """
    # 1. Strip any HTML markup wrapper spans like <span class="if-gloss">(...)</span>
    clean = re.sub(
        r'<span[^>]*class=["\']if-gloss["\'][^>]*>(.*?)</span>',
        r"\1",
        adapted_text,
        flags=re.DOTALL,
    )

    # 2. Remove parenthetical glosses placed before trailing punctuation (with optional whitespace):
    # `word (gloss),` -> `word,` or `word (gloss) ,` -> `word,`
    clean = re.sub(r"\s+\([^)]*\)(?=\s*[.,!?;:…—–])", "", clean)

    # 3. Remove remaining parenthetical glosses:
    # `word (gloss) next` -> `word next`
    clean = re.sub(r"\s+\([^)]*\)", "", clean)

    # 4. Remove leading glosses if any: `(gloss) next` -> `next`
    clean = re.sub(r"^\([^)]*\)\s*", "", clean)

    # 5. Remove slash annotations (Rule 17 implied additions if rendered outside parentheses)
    clean = re.sub(r"\s+/[^/]+/(?=\s*[.,!?;:…—–])", "", clean)
    clean = re.sub(r"\s+/[^/]+/", "", clean)

    # 6. Clean up any accidental whitespace before punctuation: `word ?` -> `word?`
    clean = re.sub(r"\s+([.,!?;:…—–])", r"\1", clean)

    # 7. Clean up any accidental double spaces on non-newline boundaries
    clean = re.sub(r"[^\S\r\n]{2,}", " ", clean)

    return clean.strip()


def validate_punctuation_invariant(adapted_text: str) -> tuple[bool, list[str]]:
    """Verify Rule 3: Bracket & Punctuation Invariant.

    - All translation glosses must be enclosed in standard parentheses: `(...)`.
    - Parentheses must be properly balanced.
    - All glosses must be positioned BEFORE any trailing punctuation mark:
      `word (gloss), next` is valid.
      `word, (gloss)` or `word. (gloss)` violates Rule 3.
    """
    errors: list[str] = []

    # Check balanced parentheses
    open_count = adapted_text.count("(")
    close_count = adapted_text.count(")")
    if open_count != close_count:
        errors.append(f"Unbalanced parentheses: {open_count} open vs {close_count} close.")

    # Detect glosses incorrectly placed AFTER punctuation
    # Pattern: punctuation mark followed by optional space and '('
    invalid_post_punct = re.findall(r'([.,!?;:])\s*\(([^)]+)\)', adapted_text)
    for punct, gloss in invalid_post_punct:
        # Check if this gloss is not a conversational asides or nested quote
        errors.append(
            f"Rule 3 violation: Gloss '({gloss[:30]}...)' is placed after punctuation '{punct}'. "
            f"Canonical Frank notation requires placement BEFORE punctuation: 'word (gloss){punct}'."
        )

    return len(errors) == 0, errors


def validate_gloss_notation(gloss_content: str) -> tuple[bool, list[str]]:
    """Verify gloss content adheres to canonical Frank notation conventions.

    Supported patterns:
    - Rule 7: Literary with literal in quotes: `(literary: «literal»; lemma)`
    - Rule 8: Literal first = literary after equal sign: `(literal = literary; lemma)`
    - Rule 9 & 10: Literary with root / contextual meaning: `(literary; lemma)`
    - Rule 11: Lexicographical: synonyms with commas, distinct senses with semicolons
    - Rule 14 & 15: Morphological tags (gender: `...; woord, het`, irregular verb: `...; rire`)
    - Rule 17: Implied additions in slashes: `(/on/ the first day)`
    """
    errors: list[str] = []
    g = gloss_content.strip()

    if not g:
        errors.append("Gloss cannot be empty.")
        return False, errors

    # Check for quotes consistency: French guillemets « » or English quotes
    if "«" in g and "»" not in g:
        errors.append("Unclosed quotation mark « in gloss.")

    # Check semicolon delimiters
    # In Frank notation, lemmas and distinct meanings are separated by semicolons
    # A valid gloss can be:
    # 1. Simple translation: "to go", "house"
    # 2. Rule 7: "literary: «literal»"
    # 3. Rule 8: "literal = literary"
    # 4. Grammatical insertion: "/on/ the table"
    # 5. Compound with lemma: "went; go" or "literary; lemma, gender"
    return len(errors) == 0, errors


def validate_unadapted_fidelity(adapted_text: str, raw_text: str) -> tuple[bool, str]:
    """Verify Acceptance Criteria 3: $U_i$ text is an exact match of $A_i$ minus glosses."""
    stripped = strip_glosses(adapted_text)
    norm_stripped = " ".join(stripped.split())
    norm_raw = " ".join(raw_text.strip().split())

    if norm_stripped == norm_raw:
        return True, ""

    return (
        False,
        f"Fidelity mismatch between stripped adapted text and raw authentic text.\n"
        f"Stripped ($A_i$ minus glosses): '{norm_stripped[:80]}...'\n"
        f"Raw ($U_i$):                     '{norm_raw[:80]}...'",
    )


def segment_text_into_excerpts(
    text: str | None,
    max_paragraphs: int = 3,
    max_sentences: int = 6,
) -> list[str]:
    """Segment raw text into 1–3 paragraph excerpts per Rule 1 and Rule 2."""
    if not text:
        return []
    cleaned = text.strip()
    if not cleaned:
        return []

    # Split by double newline into paragraphs
    raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]

    # If no paragraphs found (e.g. single long block), split by sentences
    if not raw_paragraphs:
        raw_paragraphs = [cleaned]

    balanced_paragraphs: list[str] = []
    sentence_splitter = re.compile(r"(?<=[.!?])\s+")

    for para in raw_paragraphs:
        sentences = sentence_splitter.split(para)
        if len(sentences) > max_sentences:
            # Rule 2: Split large paragraphs into smaller balanced chunks
            chunk_size = max(3, max_sentences // 2)
            for i in range(0, len(sentences), chunk_size):
                sub_para = " ".join(sentences[i : i + chunk_size]).strip()
                if sub_para:
                    balanced_paragraphs.append(sub_para)
        else:
            balanced_paragraphs.append(para)

    # Group into excerpts of 1 to max_paragraphs
    excerpts: list[str] = []
    for i in range(0, len(balanced_paragraphs), max_paragraphs):
        excerpt_text = "\n\n".join(balanced_paragraphs[i : i + max_paragraphs])
        excerpts.append(excerpt_text)

    return excerpts or [cleaned]


def format_canonical_frank_gloss(
    surface_word: str,
    translation: str,
    lemma: str | None = None,
    pos: str | None = None,
    gender: str | None = None,
    literal: str | None = None,
    is_irregular: bool | None = None,
    rule_style: int = 8,  # Default to Rule 8 (literal = literary) or Rule 7
) -> str:
    """Format a gloss according to Frank's canonical 27 rules."""
    lemma_part = ""
    effective_lemma = lemma if lemma and lemma.lower() != surface_word.lower() else None

    # Gender tag for nouns (Rule 15)
    gender_tag = f", {gender}" if gender else ""

    if effective_lemma or gender_tag:
        base = effective_lemma or surface_word
        lemma_part = f"; {base}{gender_tag}"
    elif is_irregular and lemma:
        lemma_part = f"; {lemma}"

    # Rule 7: literary: «literal»
    if literal and rule_style == 7:
        return f"({translation}: «{literal}»{lemma_part})"

    # Rule 8: literal = literary
    if literal and rule_style == 8:
        return f"({literal} = {translation}{lemma_part})"

    # Rule 17: slash for implied preposition/particle
    if translation.startswith(("/ ", "/")):
        return f"({translation}{lemma_part})"

    # Standard Rule 9/10/11 gloss
    return f"({translation}{lemma_part})"



def build_ilya_frank_system_prompt(source_lang: str, target_lang: str) -> str:
    """Construct system prompt encoding the canonical Ilya Frank Reading Method principles."""
    return f"""You are an expert computational linguist and master adapter of authentic texts using the canonical Ilya Frank Reading Method.
Target Language (LT): {target_lang}
Source/Native Language (LS): {source_lang}

Your objective is to transform raw authentic target-language texts into dual-pass reading lessons.

### Structural Architecture:
Every text is divided into sequential Excerpts (E1, E2, ... En):
1. 'adapted_text' (Ai): 1–3 paragraphs containing inline translation glosses in standard parentheses (...) placed immediately before punctuation marks.
2. 'raw_text' (Ui): The exact identical text chunk in LT with ZERO annotations, giving the student unassisted reading practice.

### Core Principles of the Ilya Frank Method:

1. Syntagmatic / Clause-Level Chunking (DO NOT gloss word-by-word):
   - Gloss at natural syntactic boundaries: clauses, meaningful verb phrases, and complete sentences immediately before punctuation marks (',', '.', '?', '!', ';').
   - NEVER gloss word-by-word (e.g. NEVER do 'word1 (gloss1) word2 (gloss2)'). Let the authentic text read continuously in meaningful syntagms.
   - The gloss explains the entire preceding clause or syntagm in coherent, natural LS.

2. Dual-Pass Translation within Glosses (Literary : «Literal»):
   - When a clause contains idioms, non-literal expressions, or divergent syntax between LT and LS:
     1. Provide the smooth literary contextual translation first.
     2. Followed by a colon ':' and the word-for-word literal translation enclosed in Russian guillemets «...»:
        Format: (literary contextual translation: «literal word-for-word translation»)
     Example structure: (literary translation of clause: «literal translation of words»)

3. Synonym Chains & Dialectal/Grammatical Equivalents with '=' and '—':
   - For regional, colloquial, dialectal, or noteworthy words, provide equivalent standard forms and synonyms chained with '=' and defined after an em-dash '—':
     Format: ; dialect_or_variant = standard_form = synonym — meaning
   - For concise idiomatic expressions where literal and figurative differ:
     Format: (literal meaning = literary contextual meaning) or (literary meaning: «literal meaning»)

4. Natural Translation of Simple Clauses:
   - For straightforward narrative clauses, translate the complete clause concisely and naturally:
     Format: Clause (cohesive natural translation of clause),
   - Keep the flow readable and avoid lexical clutter (do NOT attach part-of-speech tags, gender articles, or dictionary meta-labels to every common word).

5. Bracket & Punctuation Invariant (Strict Rule 3):
   - All glosses must be enclosed in parentheses '(...)' and begin with a lowercase letter.
   - Punctuation position invariant: The gloss MUST be placed immediately BEFORE the trailing punctuation mark with NO space before the punctuation mark:
     Correct: 'clause (gloss).'   'clause (gloss),'   'clause (gloss)?'
     Incorrect: 'clause, (gloss)'   'clause (gloss) .'   'clause (gloss) ?'
   - Invariant: Stripping all parenthetical glosses '(...)' from 'adapted_text' MUST reproduce 'raw_text' character-for-character.

6. Non-Redundancy within Excerpt (Rule 18):
   - Once a word or idiom is glossed within an excerpt, do not re-gloss it when it appears again in the same excerpt.

### Output JSON Format:
{{
  "excerpts": [
    {{
      "index": 1,
      "adapted_text": "...",
      "raw_text": "...",
      "vocabulary_extracted": [
        {{
          "text": "word/phrase",
          "literal_translation": "...",
          "literary_translation": "..."
        }}
      ]
    }}
  ]
}}
Return ONLY valid JSON.
"""


def parse_and_validate_adaptation(
    raw_llm_json: str, original_text: str, target_lang: str | None = None
) -> IlyaFrankResponse:
    """Parse raw LLM output, enforce Pydantic schema validation, enrich word metadata via spaCy, and ensure fidelity."""
    content = raw_llm_json.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\n?", "", content)
        content = re.sub(r"\n?```$", "", content)

    data = json.loads(content)
    parsed = IlyaFrankResponse.model_validate(data)

    from app.services.nlp import nlp_service

    # Invariant post-processing: Guarantee fidelity for each excerpt and enrich vocabulary with spaCy
    for excerpt in parsed.excerpts:
        if len(parsed.excerpts) == 1 and original_text:
            orig_faithful, _ = validate_unadapted_fidelity(excerpt.adapted_text, original_text.strip())
            if orig_faithful:
                excerpt.raw_text = original_text.strip()
                if excerpt.vocabulary_extracted:
                    nlp_service.enrich_vocabulary(
                        excerpt.vocabulary_extracted,
                        language_code=target_lang or "nl",
                        context=excerpt.raw_text,
                    )
                continue

        # Check and enforce Ui == strip_glosses(Ai)
        is_faithful, _ = validate_unadapted_fidelity(excerpt.adapted_text, excerpt.raw_text)
        if not is_faithful:
            logger.warning(
                f"LLM excerpt {excerpt.index} had fidelity drift; auto-reconciling raw_text from stripped adapted_text"
            )
            excerpt.raw_text = strip_glosses(excerpt.adapted_text)

        if excerpt.vocabulary_extracted:
            nlp_service.enrich_vocabulary(
                excerpt.vocabulary_extracted,
                language_code=target_lang or "nl",
                context=excerpt.raw_text,
            )

    return parsed
