import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect
from tests.mobile.conftest import login_demo_user

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_ai_translation_single_word_submission(mobile_page: Page):
    """Test AI translation of a single word or short phrase entered into the bottom dock:
    - User types 'luminary - светило' or 'luminary' in the bottom dock.
    - Server processes via JobQueue and Mock/AI Provider.
    - Flashcard immediately displays target word 'luminary', phonetic '[/ˈluː.mɪ.nər.i/]',
      and upon flip reveals translation 'светило' and example context.
    """
    page = mobile_page

    # Log in
    login_demo_user(page)

    # Clean existing words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const existing = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json());
        for (const w of (existing || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
        }
    }""")

    # Navigate to Flashcards page
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-flashcards").click()
    expect(page.locator("#flashcards-view")).to_be_visible()

    # Enter word into bottom dock
    quick_input = page.locator("#quick-word-input")
    expect(quick_input).to_be_visible()
    quick_input.fill("luminary - светило")

    # Send
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(400)

    # Verify active card front face displays target word 'luminary'
    card_word = page.locator("#card-word")
    expect(card_word).to_be_visible()
    expect(card_word).to_have_text("luminary")

    # Verify phonetic or POS is displayed
    card_phonetic = page.locator("#card-phonetic")
    expect(card_phonetic).to_be_visible()
    assert len(card_phonetic.inner_text().strip()) > 0

    # Flip card to back
    card = page.locator("#flashcard")
    card.click()
    expect(card).to_have_class(re.compile(r"(is-flipped|flipped)"))

    # Verify translation and context phrase on back
    card_translation = page.locator("#card-translation")
    expect(card_translation).to_be_visible()
    expect(card_translation).to_have_text("светило")

    card_context = page.locator("#card-context")
    expect(card_context).to_be_visible()
    assert "luminary" in card_context.inner_text()


def test_ai_translation_long_text_forms_named_lesson(mobile_page: Page):
    """Test AI translation of longer text (> 5 words) automatically forming a dedicated named Lesson:
    - User enters a sentence with > 5 words via the bottom dock.
    - Server creates a Job in JobQueue and automatically creates a named Lesson.
    - User is on Lessons view (or navigates to Lessons view).
    - A dedicated named Lesson card appears with word preview chips and word count badge.
    - Clicking the lesson opens the interactive Lesson Detail view to study the extracted words.
    """
    page = mobile_page

    # Log in
    login_demo_user(page)

    # Clean existing words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const existing = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json());
        for (const w of (existing || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers });
        }
    }""")

    # Ensure on Lessons view
    expect(page.locator("#lessons-view")).to_be_visible()

    # Enter a long sentence into the bottom dock
    long_sentence = "The quick brown fox jumps over the lazy dog and rests peacefully"
    quick_input = page.locator("#quick-word-input")
    expect(quick_input).to_be_visible()
    quick_input.fill(long_sentence)

    # Submit
    page.locator("#btn-quick-send").click()

    # Wait for async submission to finish and input to be cleared
    page.wait_for_timeout(500)

    # Wait for lesson card to appear in grid
    lessons_grid = page.locator("#lessons-grid")
    expect(lessons_grid).to_be_visible()

    # Verify lesson card exists with word pills
    first_card = page.locator(".lesson-card").first
    expect(first_card).to_be_visible()
    expect(first_card.locator(".lesson-title")).to_contain_text("Lesson")
    expect(first_card.locator(".lesson-badge")).to_contain_text("words")
    
    pills = first_card.locator(".lesson-word-pill")
    expect(pills.first).to_be_visible()
    assert pills.count() >= 1

    # Tap on the lesson card to open Lesson Detail
    first_card.click()
    detail_view = page.locator("#lesson-detail-view")
    expect(detail_view).to_be_visible()

    # Verify study card in lesson detail
    lesson_card = page.locator("#lesson-flashcard")
    expect(lesson_card).to_be_visible()

    # Flip study card
    lesson_card.click()
    expect(lesson_card).to_have_class(re.compile(r"is-flipped"))

    # Close lesson detail
    close_btn = page.locator("#btn-close-lesson")
    expect(close_btn).to_be_visible()
    close_btn.click()
    expect(page.locator("#lessons-view")).to_be_visible()
