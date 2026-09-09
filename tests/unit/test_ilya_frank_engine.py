"""Unit tests for Ilya Frank Text Adaptation & Dual-Pass Engine (TKT-008A).

Validates:
- 27-rule adaptation mechanics
- Rule 1 (Ai -> Ui pairing)
- Rule 2 (excerpt paragraph balancing)
- Rule 3 (bracket & punctuation invariant)
- Canonical gloss notation (Rule 7, 8, 14, 15, 17)
- Rule 18 (intra-chunk non-redundancy)
- Unadapted passage fidelity (Ui == strip_glosses(Ai))
"""

from app.schemas.ilya_frank import IlyaFrankExcerpt, IlyaFrankResponse
from app.services.ilya_frank import (
    format_canonical_frank_gloss,
    generate_mock_adaptation,
    parse_and_validate_adaptation,
    segment_text_into_excerpts,
    strip_glosses,
    validate_gloss_notation,
    validate_punctuation_invariant,
    validate_unadapted_fidelity,
)


def test_strip_glosses_with_punctuation_invariants():
    """Verify stripping parenthetical glosses restores the exact original punctuation."""
    # Gloss before comma
    adapted_comma = "He decided to give up (abandon = surrender; give up), and left."
    expected_comma = "He decided to give up, and left."
    assert strip_glosses(adapted_comma) == expected_comma

    # Gloss before period
    adapted_period = "They arrived at the house (het huis, het; house)."
    expected_period = "They arrived at the house."
    assert strip_glosses(adapted_period) == expected_period

    # Multiple glosses with various trailing punctuation
    sample = (
        "Le premier soir (/on/ the first night) je me suis donc endormi "
        "(so, I went to sleep; se coucher, s'endormir) sur le sable (on the sand)..."
    )
    expected = "Le premier soir je me suis donc endormi sur le sable..."
    assert strip_glosses(sample) == expected


def test_strip_glosses_html_spans():
    """Verify stripping unwraps <span class="if-gloss"> correctly."""
    html_adapted = (
        'Yesterday I decided to get off <span class="if-gloss">(alight = exit; get off)</span> '
        'the train <span class="if-gloss">(trein, de)</span>, and run.'
    )
    expected = "Yesterday I decided to get off the train, and run."
    assert strip_glosses(html_adapted) == expected


def test_validate_punctuation_invariant():
    """Verify Rule 3: Gloss must be placed BEFORE trailing punctuation."""
    # Valid: gloss before comma
    valid_text = "Het boek (book, het), dat op tafel ligt."
    is_valid, errors = validate_punctuation_invariant(valid_text)
    assert is_valid
    assert len(errors) == 0

    # Invalid: gloss after comma
    invalid_text = "Het boek, (book, het) dat op tafel ligt."
    is_valid, errors = validate_punctuation_invariant(invalid_text)
    assert not is_valid
    assert any("Rule 3 violation" in e for e in errors)

    # Invalid: unbalanced parenthesis
    unbalanced_text = "Het boek (book, het and more."
    is_valid, errors = validate_punctuation_invariant(unbalanced_text)
    assert not is_valid
    assert any("Unbalanced parentheses" in e for e in errors)


def test_validate_gloss_notation():
    """Verify canonical Frank notation conventions."""
    # Rule 7: literary: «literal»
    valid_rule7 = "having lost patience: «shortage of patience»; faute, f"
    is_valid, errors = validate_gloss_notation(valid_rule7)
    assert is_valid
    assert len(errors) == 0

    # Rule 8: literal = literary
    valid_rule8 = "the proposal seemed to shock = was shocked by the offer; paraître"
    is_valid, errors = validate_gloss_notation(valid_rule8)
    assert is_valid
    assert len(errors) == 0

    # Unclosed guillemet error
    invalid_quotes = "having lost patience: «shortage of patience; faute"
    is_valid, errors = validate_gloss_notation(invalid_quotes)
    assert not is_valid
    assert any("Unclosed quotation mark" in e for e in errors)


def test_format_canonical_frank_gloss():
    """Verify format_canonical_frank_gloss produces exact Frank notation."""
    # Rule 7: literary with literal in quotes
    g7 = format_canonical_frank_gloss(
        surface_word="endormi",
        translation="fell asleep",
        lemma="s'endormir",
        literal="went to sleep",
        rule_style=7,
    )
    assert g7 == "(fell asleep: «went to sleep»; s'endormir)"

    # Rule 8: literal = literary
    g8 = format_canonical_frank_gloss(
        surface_word="choquer",
        translation="shock",
        lemma="choquer",
        literal="hit",
        rule_style=8,
    )
    assert g8 == "(hit = shock)"

    # Rule 15: Dutch gender annotation
    g_nl = format_canonical_frank_gloss(
        surface_word="woord",
        translation="word",
        lemma="woord",
        pos="noun",
        gender="het",
    )
    assert g_nl == "(word; woord, het)"


def test_validate_unadapted_fidelity():
    """Verify fidelity check compares stripped adapted text with raw text."""
    adapted = "Hij leest een boek (book, het; boek), en drinkt water (water, het)."
    raw = "Hij leest een boek, en drinkt water."
    is_faithful, err = validate_unadapted_fidelity(adapted, raw)
    assert is_faithful
    assert err == ""

    # Divergent text fails
    bad_raw = "Hij leest een krant, en drinkt koffie."
    is_faithful, err = validate_unadapted_fidelity(adapted, bad_raw)
    assert not is_faithful
    assert "Fidelity mismatch" in err


def test_segment_text_into_excerpts():
    """Verify text is partitioned into 1-3 paragraph excerpts."""
    three_paras = "Para 1.\n\nPara 2.\n\nPara 3."
    excerpts = segment_text_into_excerpts(three_paras, max_paragraphs=3)
    assert len(excerpts) == 1

    four_paras = "Para 1.\n\nPara 2.\n\nPara 3.\n\nPara 4."
    excerpts = segment_text_into_excerpts(four_paras, max_paragraphs=2)
    assert len(excerpts) == 2


def test_generate_mock_adaptation_end_to_end():
    """Verify full end-to-end deterministic generation meets all invariants."""
    text = (
        "Yesterday I decided to get off the train and give up junk food. "
        "I gave up junk food because getting off early made me happy."
    )
    selected = ["get off", "give up", "train"]

    mock_dict = {
        "get off": ("сойти", "phrase", "/ɡet ɒf/"),
        "give up": ("сдаваться", "phrase", "/ɡɪv ʌp/"),
        "train": ("поезд", "noun", "/treɪn/"),
    }

    resp = generate_mock_adaptation(
        text=text,
        selected_words=selected,
        source_lang="ru",
        target_lang="en",
        dictionary_lookup=lambda w, lang: mock_dict.get(w.lower()),
    )

    assert isinstance(resp, IlyaFrankResponse)
    assert len(resp.excerpts) >= 1

    exc = resp.excerpts[0]
    assert exc.index == 1

    # Invariant 1: Bracket & punctuation invariant
    is_punct_valid, punct_errs = validate_punctuation_invariant(exc.adapted_text)
    assert is_punct_valid, f"Punctuation errors: {punct_errs}"

    # Invariant 2: Unadapted passage fidelity (Ui == strip_glosses(Ai))
    is_faithful, fidelity_err = validate_unadapted_fidelity(exc.adapted_text, exc.raw_text)
    assert is_faithful, f"Fidelity error: {fidelity_err}"

    # Invariant 3: Rule 18 non-redundancy (give up appears twice, but glossed only once)
    assert exc.adapted_text.count("give up (") == 1

    # Invariant 4: Vocabulary extracted matches WordBase schema
    assert len(exc.vocabulary_extracted) >= 2
    for word_item in exc.vocabulary_extracted:
        assert word_item.text
        assert word_item.word == word_item.text


def test_parse_and_validate_adaptation_reconciliation():
    """Verify JSON parsing and auto-reconciliation of raw_text from adapted_text."""
    raw_json = """
    {
      "excerpts": [
        {
          "index": 1,
          "adapted_text": "Ik zie een mooi huis (house; huis, het) in Amsterdam.",
          "raw_text": "Ik zie een ander huis...",
          "vocabulary_extracted": [
            {
              "text": "huis",
              "lemma": "huis",
              "pos": "noun",
              "gender": "het"
            }
          ]
        }
      ]
    }
    """
    res = parse_and_validate_adaptation(raw_json, "Ik zie een mooi huis in Amsterdam.")
    assert len(res.excerpts) == 1
    # Auto-reconciliation should have corrected raw_text to match stripped adapted_text
    assert res.excerpts[0].raw_text == "Ik zie een mooi huis in Amsterdam."
