from datetime import datetime, timedelta, timezone
import pytest

from app.srs.engine import SM2Engine, SRSEngine
from app.srs.models import CardState, Rating, parse_rating


def test_srs_engine_protocol_conformance():
    engine = SM2Engine()
    assert isinstance(engine, SRSEngine)


def test_parse_rating_valid():
    assert parse_rating(Rating.AGAIN) == 1
    assert parse_rating(Rating.HARD) == 3
    assert parse_rating(Rating.GOOD) == 4
    assert parse_rating(Rating.EASY) == 5

    assert parse_rating("again") == 1
    assert parse_rating("hard") == 3
    assert parse_rating("good") == 4
    assert parse_rating("easy") == 5

    assert parse_rating("AGAIN") == 1
    assert parse_rating("Good ") == 4
    assert parse_rating("5") == 5
    assert parse_rating(0) == 0
    assert parse_rating(4) == 4


def test_parse_rating_invalid():
    with pytest.raises(ValueError):
        parse_rating("invalid_rating")

    with pytest.raises(ValueError):
        parse_rating(-1)

    with pytest.raises(ValueError):
        parse_rating(6)

    with pytest.raises(TypeError):
        parse_rating([1, 2])


def test_sm2_initial_good_review():
    engine = SM2Engine()
    initial_state = CardState()
    fixed_now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # First review: Good (4)
    result1 = engine.calculate_next_review(initial_state, Rating.GOOD, review_time=fixed_now)
    assert result1.state.repetition_number == 1
    assert result1.state.interval_days == 1.0
    assert result1.state.ease_factor == 2.5
    assert result1.state.recall_count == 1
    assert result1.state.fail_count == 0
    assert result1.state.next_review_at == fixed_now + timedelta(days=1)
    assert result1.state.last_reviewed_at == fixed_now


def test_sm2_standard_progression_good():
    engine = SM2Engine()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # 1st review (q=4)
    res1 = engine.calculate_next_review(CardState(), Rating.GOOD, review_time=now)
    assert res1.state.repetition_number == 1
    assert res1.state.interval_days == 1.0
    assert res1.state.ease_factor == 2.5

    # 2nd review (q=4)
    res2 = engine.calculate_next_review(res1.state, Rating.GOOD, review_time=res1.state.next_review_at)
    assert res2.state.repetition_number == 2
    assert res2.state.interval_days == 6.0
    assert res2.state.ease_factor == 2.5

    # 3rd review (q=4) -> interval = round(6.0 * 2.5) = 15
    res3 = engine.calculate_next_review(res2.state, Rating.GOOD, review_time=res2.state.next_review_at)
    assert res3.state.repetition_number == 3
    assert res3.state.interval_days == 15.0
    assert res3.state.ease_factor == 2.5

    # 4th review (q=4) -> interval = round(15.0 * 2.5) = 38
    res4 = engine.calculate_next_review(res3.state, Rating.GOOD, review_time=res3.state.next_review_at)
    assert res4.state.repetition_number == 4
    assert res4.state.interval_days == 38.0
    assert res4.state.ease_factor == 2.5
    assert res4.state.recall_count == 4
    assert res4.state.fail_count == 0


def test_sm2_easy_progression_ef_increase():
    engine = SM2Engine()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # 1st review Easy (q=5) -> EF = 2.5 + 0.1 = 2.6
    res1 = engine.calculate_next_review(CardState(), Rating.EASY, review_time=now)
    assert res1.state.repetition_number == 1
    assert res1.state.interval_days == 1.0
    assert res1.state.ease_factor == 2.6

    # 2nd review Easy (q=5) -> EF = 2.6 + 0.1 = 2.7
    res2 = engine.calculate_next_review(res1.state, Rating.EASY, review_time=res1.state.next_review_at)
    assert res2.state.repetition_number == 2
    assert res2.state.interval_days == 6.0
    assert res2.state.ease_factor == 2.7

    # 3rd review Easy (q=5) -> EF = 2.7 + 0.1 = 2.8, interval = round(6.0 * 2.8) = 17
    res3 = engine.calculate_next_review(res2.state, Rating.EASY, review_time=res2.state.next_review_at)
    assert res3.state.repetition_number == 3
    assert res3.state.interval_days == 17.0
    assert res3.state.ease_factor == 2.8


def test_sm2_hard_progression_ef_decrease():
    engine = SM2Engine()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # 1st review Hard (q=3) -> delta_ef = 0.1 - 2*(0.08 + 0.04) = -0.14 -> EF = 2.36
    res1 = engine.calculate_next_review(CardState(), Rating.HARD, review_time=now)
    assert res1.state.repetition_number == 1
    assert res1.state.interval_days == 1.0
    assert res1.state.ease_factor == 2.36

    # 2nd review Hard (q=3) -> EF = 2.36 - 0.14 = 2.22
    res2 = engine.calculate_next_review(res1.state, Rating.HARD, review_time=res1.state.next_review_at)
    assert res2.state.repetition_number == 2
    assert res2.state.interval_days == 6.0
    assert res2.state.ease_factor == 2.22

    # 3rd review Hard (q=3) -> EF = 2.22 - 0.14 = 2.08, interval = round(6.0 * 2.08) = 12
    res3 = engine.calculate_next_review(res2.state, Rating.HARD, review_time=res2.state.next_review_at)
    assert res3.state.repetition_number == 3
    assert res3.state.interval_days == 12.0
    assert res3.state.ease_factor == 2.08


def test_sm2_again_failure_resets_repetition():
    engine = SM2Engine()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Advanced state: rep=4, interval=38, EF=2.5
    mature_state = CardState(
        repetition_number=4,
        interval_days=38.0,
        ease_factor=2.5,
        recall_count=4,
        fail_count=0,
    )

    # Review with Again (1) -> delta_ef = 0.1 - 4*(0.08 + 0.08) = 0.1 - 0.64 = -0.54 -> EF = 1.96
    res = engine.calculate_next_review(mature_state, Rating.AGAIN, review_time=now)
    assert res.state.repetition_number == 0
    assert res.state.interval_days == 1.0
    assert res.state.ease_factor == 1.96
    assert res.state.fail_count == 1
    assert res.state.recall_count == 4


def test_sm2_ease_factor_floor_minimum():
    engine = SM2Engine(min_ease_factor=1.3)
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    state = CardState(ease_factor=1.4)
    # Consecutive failures (q=0): delta_ef = 0.1 - 5*(0.08 + 0.10) = -0.80
    res1 = engine.calculate_next_review(state, 0, review_time=now)
    assert res1.state.ease_factor == 1.3  # clamped to minimum

    res2 = engine.calculate_next_review(res1.state, 0, review_time=now)
    assert res2.state.ease_factor == 1.3  # still clamped to minimum


def test_sm2_all_score_ratings():
    engine = SM2Engine()
    now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    for q in range(6):
        res = engine.calculate_next_review(CardState(), score=q, review_time=now)
        assert res.score == q
        if q < 3:
            assert res.state.repetition_number == 0
            assert res.state.interval_days == 1.0
            assert res.state.fail_count == 1
        else:
            assert res.state.repetition_number == 1
            assert res.state.interval_days == 1.0
            assert res.state.recall_count == 1
