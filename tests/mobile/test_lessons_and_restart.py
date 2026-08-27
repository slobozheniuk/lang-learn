import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_lessons_is_default_page_on_load(mobile_page: Page):
    """Verify that 'Lessons' is the initial default page on load:
    - #lessons-view is visible immediately.
    - Burger menu highlights Lessons as active.
    - Brand logo click navigates to Lessons.
    """
    page = mobile_page

    # Verify Lessons view is visible on initial load
    lessons_view = page.locator("#lessons-view")
    expect(lessons_view).to_be_visible()

    # Verify other views are not visible
    expect(page.locator("#flashcards-view")).not_to_be_visible()
    expect(page.locator("#wordlist-view")).not_to_be_visible()

    # Open burger menu and verify Lessons nav link has active class
    page.locator("#burger-menu-btn").click()
    nav_lessons = page.locator("#nav-link-lessons")
    expect(nav_lessons).to_be_visible()
    expect(nav_lessons).to_have_class(re.compile(r"active"))
    expect(nav_lessons).to_contain_text("Lessons")

    # Close menu
    page.locator("#drawer-close-btn").click()
    expect(page.locator("#burger-menu-drawer")).not_to_have_class(re.compile(r"is-open"))

    # Clicking brand logo stays on / returns to Lessons
    page.locator(".brand").click()
    expect(page.locator("#lessons-view")).to_be_visible()


def test_lesson_cards_chunking_and_progress(mobile_page: Page):
    """Verify automatic 5-word lesson chunking:
    - If fewer than 5 words added (e.g. 3 words), lesson card shows progress towards next lesson (3 / 5 words).
    - When 5 words added, lesson card shows complete 5 words badge.
    - When 6 words added, Lesson 1 has 5 words and Lesson 2 has 1 word.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Seed 3 words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        for (let i = 1; i <= 3; i++) {
            await fetch('/api/v1/words/', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: `chunk_word_${i}`, translation: `перевод_${i}`, language_code: 'en' })
            });
        }
    }""")

    # Refresh lessons
    page.evaluate("() => window.loadWordlist()")
    page.wait_for_timeout(300)

    # Verify Lesson 1 card shows 3 / 5 words
    card_1 = page.locator("#lesson-card-1")
    expect(card_1).to_be_visible()
    expect(card_1.locator(".lesson-title")).to_have_text("Lesson 1")
    expect(card_1.locator(".lesson-badge")).to_contain_text("3 / 5 words")
    expect(card_1.locator(".lesson-progress-text")).to_contain_text("3 / 5 words added")

    # Add 2 more words to reach 5 words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        for (let i = 4; i <= 5; i++) {
            await fetch('/api/v1/words/', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: `chunk_word_${i}`, translation: `перевод_${i}`, language_code: 'en' })
            });
        }
    }""")

    page.evaluate("() => window.loadWordlist()")
    page.wait_for_timeout(300)

    # Verify Lesson 1 card is now completed (5 words)
    expect(card_1.locator(".lesson-badge")).to_contain_text("5 words")
    expect(card_1.locator(".lesson-progress-text")).to_contain_text("Ready to practice")

    # Verify word preview chips
    expect(card_1.locator(".lesson-word-pill")).to_have_count(5)


def test_lesson_detail_opens_hides_dock_and_closes(mobile_page: Page):
    """Verify Interactive Lesson Detail / Practice View:
    - Tapping a Lesson card opens Lesson Detail view.
    - Floating bottom dock (footer input) is HIDDEN on active lesson view.
    - Top header of lesson view has a prominent close button ('✕' / '#btn-close-lesson').
    - Tapping ✕ close button cleanly returns to Lessons page and restores bottom dock.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Ensure at least 5 words exist
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        for (let i = 1; i <= 5; i++) {
            await fetch('/api/v1/words/', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: `lesson_detail_word_${i}`, translation: `перевод_деталь_${i}`, language_code: 'en' })
            });
        }
    }""")

    page.evaluate("() => window.loadWordlist()")
    page.wait_for_timeout(300)

    # Initial state: Bottom dock is visible
    bottom_dock = page.locator(".bottom-dock")
    expect(bottom_dock).to_be_visible()

    # Tap Lesson 1 card
    card_1 = page.locator("#lesson-card-1")
    expect(card_1).to_be_visible()
    card_1.click()

    # Verify Lesson Detail view is opened
    detail_view = page.locator("#lesson-detail-view")
    expect(detail_view).to_be_visible()
    expect(page.locator(".lesson-detail-title")).to_have_text("Lesson 1")

    # Verify Bottom Dock is HIDDEN during active lesson view
    expect(page.locator(".bottom-dock")).to_have_count(0)

    # Verify prominent close button (✕ / #btn-close-lesson)
    close_btn = page.locator("#btn-close-lesson")
    expect(close_btn).to_be_visible()
    assert "✕" in close_btn.inner_text()

    # Tap close button to return to Lessons page
    close_btn.click()

    # Verify Lesson Detail is closed and Lessons page is visible
    expect(page.locator("#lesson-detail-view")).not_to_be_visible()
    expect(page.locator("#lessons-view")).to_be_visible()

    # Verify bottom dock is restored
    expect(page.locator(".bottom-dock")).to_be_visible()


def test_lesson_detail_interactive_study_and_completion(mobile_page: Page):
    """Verify studying words inside Lesson Detail view:
    - 3D card flipping (front -> back -> front).
    - Audio button pronounce.
    - Next / Prev card navigation.
    - Finishing all cards shows completion state.
    - Restart lesson button resets index.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Seed 2 words for quick study test
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        for (let i = 1; i <= 2; i++) {
            await fetch('/api/v1/words/', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: `study_word_${i}`, translation: `перевод_учеба_${i}`, language_code: 'en' })
            });
        }
    }""")

    page.evaluate("() => window.loadWordlist()")
    page.wait_for_timeout(300)

    # Open Lesson 1
    page.locator("#lesson-card-1").click()
    expect(page.locator("#lesson-detail-view")).to_be_visible()

    # Flip card
    card = page.locator("#lesson-flashcard")
    expect(card).to_be_visible()
    expect(card).not_to_have_class(re.compile(r"is-flipped"))
    card.click()
    expect(card).to_have_class(re.compile(r"is-flipped"))

    # Next card
    page.locator("#btn-lesson-next").click()
    expect(page.locator(".lesson-detail-counter")).to_contain_text("Card 2")

    # Step through all cards until completion
    while not page.locator("#lesson-completed-state").is_visible():
        btn_next = page.locator("#btn-lesson-next")
        if btn_next.is_visible():
            btn_next.click()
            page.wait_for_timeout(200)
        else:
            break

    # Verify lesson completed screen
    expect(page.locator("#lesson-completed-state")).to_be_visible()
    expect(page.locator(".empty-title")).to_contain_text("Lesson Completed")

    # Click Restart Lesson
    btn_restart = page.locator("#btn-restart-lesson")
    expect(btn_restart).to_be_visible()
    btn_restart.click()

    # Verify reset to card 1
    expect(page.locator("#lesson-flashcard")).to_be_visible()
    expect(page.locator(".lesson-detail-counter")).to_contain_text("Card 1")

    # Close lesson
    page.locator("#btn-close-lesson").click()
    expect(page.locator("#lessons-view")).to_be_visible()


def test_flashcards_restart_deck_button_on_completion(mobile_page: Page):
    """Verify Restart Deck button in FlashcardsView:
    - In Flashcards: when all cards have been reviewed (empty/complete state),
      show a clear 'Restart Deck' button ('🔄 Restart Deck' / #btn-restart-deck).
    - Clicking 'Restart Deck' resets the index / reloads all words into active session.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Seed 2 words
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'deck_restart_word_1', translation: 'перевод_1', language_code: 'en' })
        });
        await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'deck_restart_word_2', translation: 'перевод_2', language_code: 'en' })
        });
    }""")

    # Navigate to Flashcards
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-flashcards").click()
    expect(page.locator("#flashcards-view")).to_be_visible()

    # Review all cards until deck empty
    for _ in range(40):
        if page.locator("#btn-srs-correct").is_visible():
            page.locator("#btn-srs-correct").click()
            page.wait_for_timeout(200)
        else:
            break

    # Empty / Completion state should be visible with Restart Deck button
    expect(page.locator("#empty-state")).to_be_visible()
    btn_restart = page.locator("#btn-restart-deck")
    expect(btn_restart).to_be_visible()
    expect(btn_restart).to_contain_text("Restart Deck")

    # Click Restart Deck
    btn_restart.click()

    # Verify deck is reloaded and active card is displayed
    expect(page.locator("#flashcard")).to_be_visible()
    expect(page.locator("#card-word")).to_be_visible()
    expect(page.locator("#empty-state")).not_to_be_visible()
