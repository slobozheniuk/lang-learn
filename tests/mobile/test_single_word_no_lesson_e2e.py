import pytest
from playwright.sync_api import Page, expect
from tests.mobile.conftest import login_demo_user


def test_single_word_submission_creates_no_lesson_e2e(mobile_page: Page):
    """
    Playwright E2E Test:
    1. Register/log in demo user.
    2. Submit a single word via bottom dock.
    3. Navigate to Lessons view -> verify 0 lessons (empty state shown).
    4. Navigate to Wordlist tab.
    5. Assert that the word IS present in the wordlist.
    """
    page = mobile_page

    # 1. Ensure logged in
    expect(page.locator("#auth-view")).to_be_visible()
    login_demo_user(page)

    # Clean existing lessons and words to ensure clean state
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };
        const existingWords = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const w of (existingWords || [])) {
            await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
        const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then(r => r.json()).catch(() => []);
        for (const l of (existingLessons || [])) {
            await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
        }
    }""")

    # Refresh views
    page.evaluate("() => { if (window.loadWordlist) window.loadWordlist(); if (window.loadLessons) window.loadLessons(); }")
    page.wait_for_timeout(300)

    # 2. Type a single word in the bottom dock text input
    test_word = "fiets"
    test_translation = "велосипед"
    quick_input = page.locator("#quick-word-input")
    expect(quick_input).to_be_visible()
    quick_input.fill(f"{test_word} - {test_translation}")

    # Click submit / send
    btn_send = page.locator("#btn-quick-send")
    expect(btn_send).to_be_enabled()
    btn_send.click()

    # Wait for input to clear and processing to complete
    expect(quick_input).to_have_value("")
    page.wait_for_timeout(500)

    # 3. Navigate to Lessons view
    if not page.locator("#lessons-view").is_visible():
        page.locator("#burger-menu-btn").click()
        page.locator("#nav-link-lessons").click()

    expect(page.locator("#lessons-view")).to_be_visible()

    # Assert that Lessons list is EMPTY (0 lessons, empty state visible, no lesson cards)
    expect(page.locator(".lesson-card")).to_have_count(0)
    expect(page.locator("#lessons-empty")).to_be_visible()

    # 4. Navigate to Wordlist tab
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-wordlist").click()
    expect(page.locator("#wordlist-view")).to_be_visible()

    # Assert that the word IS present in the wordlist
    card = page.locator(f".word-card:has-text('{test_word}')")
    expect(card).to_be_visible()
