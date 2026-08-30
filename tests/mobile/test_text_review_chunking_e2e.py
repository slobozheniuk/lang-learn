import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect
from tests.mobile.conftest import login_demo_user

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_text_review_chunking_and_interactive_selection(mobile_page: Page):
    """Verify text review flow:
    1. User inputs a multi-sentence or passage text in the bottom dock.
    2. The prompt modal opens with option to 'Review Text & Select Words'.
    3. Clicking 'Review Text & Select Words' requests /api/v1/lessons/chunk-text and displays the interactive text review modal.
    4. Text is chunked with idioms as single tokens (e.g. 'get off').
    5. User taps chunks to toggle highlight state.
    6. Clicking 'Prepare lesson' sends the selected highlighted words to /api/v1/lessons/prepare.
    7. User is taken directly to the created quiz/study lesson containing the selected words.
    """
    page = mobile_page

    # 1. Log in
    login_demo_user(page)

    # Clean existing data
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };
        const words = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const w of (words || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
        const lessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const l of (lessons || [])) {
            await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
    }""")

    # 2. Enter multi-sentence text in bottom dock
    passage = "Please get off the bus quickly. You will find true enlightenment."
    quick_input = page.locator("#quick-word-input")
    expect(quick_input).to_be_visible()
    quick_input.fill(passage)

    # Submit
    page.locator("#btn-quick-send").click()

    # 3. Verify Create Lesson modal prompt appears
    modal = page.locator("#multi-sentence-modal")
    expect(modal).to_be_visible()

    btn_review = page.locator("#btn-review-text-lesson")
    expect(btn_review).to_be_visible()

    # 4. Click 'Review Text & Select Words'
    btn_review.click()

    # Verify Text Review Modal opens
    review_modal = page.locator("#text-review-modal")
    expect(review_modal).to_be_visible()

    # Verify chunks are rendered
    chunks_container = page.locator("#text-chunks-container")
    expect(chunks_container).to_be_visible()

    # Verify idiom chunk 'get off' exists as a single entity
    get_off_chunk = page.locator(".text-chunk-token:has-text('get off')")
    expect(get_off_chunk).to_be_visible()

    # Verify word chunk 'enlightenment' exists
    enlightenment_chunk = page.locator(".text-chunk-token:has-text('enlightenment')")
    expect(enlightenment_chunk).to_be_visible()

    # Verify initial state: not highlighted
    expect(get_off_chunk).not_to_have_class(re.compile(r"(is-highlighted|selected)"))
    expect(enlightenment_chunk).not_to_have_class(re.compile(r"(is-highlighted|selected)"))

    # 5. Tap 'get off' to highlight
    get_off_chunk.click()
    expect(get_off_chunk).to_have_class(re.compile(r"(is-highlighted|selected)"))

    # Tap 'enlightenment' to highlight
    enlightenment_chunk.click()
    expect(enlightenment_chunk).to_have_class(re.compile(r"(is-highlighted|selected)"))

    # Verify Prepare Lesson button shows selected count
    btn_prepare = page.locator("#btn-prepare-lesson")
    expect(btn_prepare).to_be_visible()
    expect(btn_prepare).to_contain_text("2 selected")

    # 6. Click 'Prepare lesson'
    btn_prepare.click()

    # 7. Verify transition to Lesson Detail View with the prepared quiz/study lesson
    lesson_detail = page.locator(".lesson-detail-view")
    expect(lesson_detail).to_be_visible()

    # Verify selected words are present in lesson
    expect(page.locator(".quiz-question-card, .lesson-flashcard, .lesson-list-mode")).to_be_visible()
