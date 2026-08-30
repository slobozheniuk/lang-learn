import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect
from tests.mobile.conftest import login_demo_user

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_reading_chunk_selection_and_prepare_lesson_flow(mobile_page: Page):
    """Test full Interactive Reading & Word Selection flow:
    1. Login demo user.
    2. Submit multi-sentence text in bottom dock.
    3. Multi-sentence modal appears -> Click 'Generate Quiz Lesson' / 'Create Lesson'.
    4. Lesson opens in Interactive Reading & Selection mode.
    5. Tap semantic chunks ('get off', 'give up') -> highlights chips and updates counter.
    6. Click 'Prepare Lesson (2 words selected)' -> prepares quiz and extracts only those 2 words.
    7. Transitions directly into Quiz mode.
    8. Answer questions and complete quiz.
    9. Back to Lessons view.
    """
    page = mobile_page
    login_demo_user(page)

    # Clean existing lessons and words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };
        const lessons = await fetch('/api/v1/lessons/', { headers }).then(r => r.json()).catch(() => []);
        for (const l of (lessons || [])) {
            await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
        const words = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const w of (words || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
    }""")

    # Submit multi-sentence text in bottom dock
    dock_input = page.locator("#quick-word-input")
    expect(dock_input).to_be_visible()
    dock_input.fill("Yesterday I decided to get off the train and give up junk food. It was a great day.")
    page.locator("#btn-quick-send").click()

    # Modal prompt for multi-sentence lesson appears
    modal = page.locator("#multi-sentence-modal")
    expect(modal).to_be_visible(timeout=10000)

    # Click Generate Lesson from modal
    btn_generate = page.locator("#btn-generate-quiz-lesson")
    expect(btn_generate).to_be_visible()
    btn_generate.click()

    # Lesson opens in reading mode
    reading_container = page.locator("#reading-study-container")
    expect(reading_container).to_be_visible(timeout=15000)

    # Mode toggle shows Read active
    btn_mode_read = page.locator("#btn-mode-reading")
    expect(btn_mode_read).to_have_class(re.compile(r"active"))

    # Verify clickable chips exist
    chips = page.locator(".reading-chunk-chip")
    expect(chips.first).to_be_visible()

    # Prepare button initially disabled with 0 words selected
    btn_prepare = page.locator("#btn-prepare-lesson")
    expect(btn_prepare).to_be_visible()
    expect(btn_prepare).to_be_disabled()
    expect(page.locator("#selected-chunks-count")).to_contain_text("0 words selected")

    # Find and tap chunk "get off"
    get_off_chip = page.locator(".reading-chunk-chip", has_text="get off").first
    expect(get_off_chip).to_be_visible()
    get_off_chip.click()
    expect(get_off_chip).to_have_class(re.compile(r"chunk-highlighted"))
    expect(page.locator("#selected-chunks-count")).to_contain_text("1 word selected")
    expect(btn_prepare).to_be_enabled()

    # Find and tap chunk "give up"
    give_up_chip = page.locator(".reading-chunk-chip", has_text="give up").first
    expect(give_up_chip).to_be_visible()
    give_up_chip.click()
    expect(give_up_chip).to_have_class(re.compile(r"chunk-highlighted"))
    expect(page.locator("#selected-chunks-count")).to_contain_text("2 words selected")

    page.screenshot(path=str(SCREENSHOTS_DIR / "01_reading_chunks_highlighted.png"))

    # Click Prepare Lesson button
    btn_prepare.click()

    # Should transition to Quiz study mode
    quiz_container = page.locator("#quiz-study-container")
    expect(quiz_container).to_be_visible(timeout=15000)

    btn_mode_quiz = page.locator("#btn-mode-quiz")
    expect(btn_mode_quiz).to_have_class(re.compile(r"active"))

    # Answer quiz question
    option_0 = page.locator("#quiz-option-0")
    expect(option_0).to_be_visible()
    option_0.click()

    page.screenshot(path=str(SCREENSHOTS_DIR / "02_quiz_mode_after_prepare.png"))

    # Click next / finish question
    btn_next_q = page.locator("#btn-next-quiz-question")
    expect(btn_next_q).to_be_enabled()
    btn_next_q.click()

    # If there's another question, answer it too
    if page.locator("#quiz-option-0").is_visible():
        page.locator("#quiz-option-0").click()
        page.locator("#btn-next-quiz-question").click()

    # Verify quiz completed state
    expect(page.locator("#quiz-completed-state")).to_be_visible(timeout=10000)

    # Click back to Lessons
    page.locator("#btn-finish-quiz-back").click()
    expect(page.locator("#lessons-view")).to_be_visible()


def test_interactive_reading_unhighlight_toggle(mobile_page: Page):
    """Test that tapping an already highlighted chip untoggles it and updates the counter."""
    page = mobile_page
    login_demo_user(page)

    # Create reading lesson via API
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        await fetch('/api/v1/lessons/chunk-text', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                text: 'She decided to wake up and look forward to the adventure.',
                source_lang: 'ru',
                target_lang: 'en',
                create_lesson: true,
                title: 'Adventure Story'
            })
        });
    }""")

    page.reload()
    expect(page.locator("#lessons-view")).to_be_visible()

    # Open the reading lesson
    lesson_card = page.locator(".lesson-card", has_text="Adventure Story").first
    expect(lesson_card).to_be_visible(timeout=10000)
    lesson_card.click()

    # Reading container is open
    expect(page.locator("#reading-study-container")).to_be_visible()

    # Tap "wake up"
    chip = page.locator(".reading-chunk-chip", has_text="wake up").first
    expect(chip).to_be_visible()
    chip.click()
    expect(chip).to_have_class(re.compile(r"chunk-highlighted"))
    expect(page.locator("#selected-chunks-count")).to_contain_text("1 word selected")
    expect(page.locator("#btn-prepare-lesson")).to_be_enabled()

    # Tap "wake up" again to untoggle
    chip.click()
    expect(chip).not_to_have_class(re.compile(r"chunk-highlighted"))
    expect(page.locator("#selected-chunks-count")).to_contain_text("0 words selected")
    expect(page.locator("#btn-prepare-lesson")).to_be_disabled()

    # Close lesson
    page.locator("#btn-close-lesson").click()
    expect(page.locator("#lessons-view")).to_be_visible()

    # Clean up test lesson
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };
        const lessons = await fetch('/api/v1/lessons/', { headers }).then(r => r.json()).catch(() => []);
        for (const l of (lessons || [])) {
            await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
        const words = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const w of (words || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
    }""")
