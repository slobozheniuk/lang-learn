import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_cheeseburger_menu_open_and_close(mobile_page: Page):
    """Test Cheeseburger Menu:
    - Button ☰ is visible in header.
    - Clicking ☰ opens drawer menu & backdrop.
    - Clicking backdrop outside drawer closes drawer.
    - Opening again and clicking close button (✕) closes drawer.
    """
    page = mobile_page

    burger_btn = page.locator("#burger-menu-btn")
    expect(burger_btn).to_be_visible()
    assert "☰" in burger_btn.inner_text()

    # Open burger menu
    burger_btn.click()
    drawer = page.locator("#burger-menu-drawer")
    backdrop = page.locator("#menu-backdrop")
    expect(drawer).to_have_class(re.compile(r"(is-open|open|active)"))
    expect(backdrop).to_have_class(re.compile(r"(is-open|open|active|show)"))

    # Verify navigation links exist in drawer
    expect(page.locator("#nav-link-flashcards")).to_be_visible()
    expect(page.locator("#nav-link-wordlist")).to_be_visible()

    # Close via backdrop click (click exposed backdrop area to right of 270px drawer on 390px viewport)
    backdrop.click(position={"x": 330, "y": 200})
    expect(drawer).not_to_have_class(re.compile(r"is-open"))

    # Open again and close via close button
    burger_btn.click()
    expect(drawer).to_have_class(re.compile(r"(is-open|open|active)"))
    close_btn = page.locator("#drawer-close-btn")
    expect(close_btn).to_be_visible()
    close_btn.click()
    expect(drawer).not_to_have_class(re.compile(r"is-open"))


def test_navigation_between_flashcards_and_wordlist(mobile_page: Page):
    """Test switching cleanly between Flashcards and Wordlist pages:
    - Navigating to Wordlist displays word list view and updates page title.
    - Navigating back to Flashcards displays flashcard learning view.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Initial page is Flashcards
    expect(page.locator("#page-title")).to_have_text("Flashcards")
    expect(page.locator("#flashcards-view")).to_be_visible()

    # Open burger menu and navigate to Wordlist
    page.locator("#burger-menu-btn").click()
    nav_wordlist = page.locator("#nav-link-wordlist")
    expect(nav_wordlist).to_be_visible()
    nav_wordlist.click()

    # Verify Wordlist view is shown and drawer is closed
    expect(page.locator("#burger-menu-drawer")).not_to_have_class(re.compile(r"is-open"))
    expect(page.locator("#wordlist-view")).to_be_visible()
    expect(page.locator("#page-title")).to_have_text("Wordlist")
    expect(page.locator("#flashcards-view")).not_to_be_visible()

    # Open burger menu and navigate back to Flashcards
    page.locator("#burger-menu-btn").click()
    nav_flashcards = page.locator("#nav-link-flashcards")
    expect(nav_flashcards).to_be_visible()
    nav_flashcards.click()

    # Verify Flashcards view is shown and drawer is closed
    expect(page.locator("#burger-menu-drawer")).not_to_have_class(re.compile(r"is-open"))
    expect(page.locator("#flashcards-view")).to_be_visible()
    expect(page.locator("#page-title")).to_have_text("Flashcards")
    expect(page.locator("#wordlist-view")).not_to_be_visible()


def test_wordlist_recall_rate_badges_and_color_coding(mobile_page: Page):
    """Test Wordlist:
    - Displays words sorted from least known (lowest recall rate %) to most known (highest recall rate %).
    - Left indicator badges:
        * Red: 0% to 50%
        * Yellow/Amber: 50% to 75%
        * Green: 75% to 99%
        * 100%: Green indicator + vibrant Green border around the entire word panel (.word-card-perfect).
    - Center section: Bold word, translation below in smaller muted font.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Seed 4 words with specific recall rates
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

        // 1. Word with 0% recall (0 reviews) -> Red
        const w1 = await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'word_red_zero', translation: 'красный_ноль', language_code: 'en' })
        }).then(r => r.json());

        // 2. Word with 67% recall (2 good, 1 again) -> Yellow
        const w2 = await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'word_yellow_mid', translation: 'желтый_средний', language_code: 'en' })
        }).then(r => r.json());
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w2.id, rating: 'again' }) });

        // 3. Word with 80% recall (4 good, 1 again) -> Green
        const w3 = await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'word_green_high', translation: 'зеленый_высокий', language_code: 'en' })
        }).then(r => r.json());
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w3.id, rating: 'again' }) });

        // 4. Word with 100% recall (2 good, 0 again) -> Perfect Green + Vibrant Border
        const w4 = await fetch('/api/v1/words/', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: 'word_perfect_master', translation: 'мастер_сотка', language_code: 'en' })
        }).then(r => r.json());
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w4.id, rating: 'good' }) });
        await fetch('/api/v1/review/submit', { method: 'POST', headers, body: JSON.stringify({ word_id: w4.id, rating: 'good' }) });
    }""")

    # Navigate to Wordlist
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-wordlist").click()
    expect(page.locator("#wordlist-view")).to_be_visible()

    # Find the cards
    card_red = page.locator(".word-card:has-text('word_red_zero')")
    card_yellow = page.locator(".word-card:has-text('word_yellow_mid')")
    card_green = page.locator(".word-card:has-text('word_green_high')")
    card_perfect = page.locator(".word-card:has-text('word_perfect_master')")

    expect(card_red).to_be_visible()
    expect(card_yellow).to_be_visible()
    expect(card_green).to_be_visible()
    expect(card_perfect).to_be_visible()

    # Verify recall rate badges and colors
    badge_red = card_red.locator(".word-recall-badge")
    expect(badge_red).to_have_class(re.compile(r"badge-red"))
    expect(badge_red).to_have_text("0%")

    badge_yellow = card_yellow.locator(".word-recall-badge")
    expect(badge_yellow).to_have_class(re.compile(r"badge-yellow"))
    expect(badge_yellow).to_have_text("67%")

    badge_green = card_green.locator(".word-recall-badge")
    expect(badge_green).to_have_class(re.compile(r"badge-green"))
    expect(badge_green).to_have_text("80%")

    badge_perfect = card_perfect.locator(".word-recall-badge")
    expect(badge_perfect).to_have_class(re.compile(r"badge-perfect"))
    expect(badge_perfect).to_have_text("100%")

    # Verify 100% recall card has vibrant green border (.word-card-perfect)
    expect(card_perfect).to_have_class(re.compile(r"word-card-perfect"))
    border_color = card_perfect.evaluate("el => window.getComputedStyle(el).borderColor")
    # Vibrant green #10b981 is rgb(16, 185, 129)
    assert "16, 185, 129" in border_color or "rgb(16, 185, 129)" in border_color

    # Verify center content structure: Bold target word and translation
    expect(card_perfect.locator(".word-text-bold strong")).to_have_text("word_perfect_master")
    expect(card_perfect.locator(".word-translation-sub")).to_have_text("мастер_сотка")

    # Verify default sorting order: lowest recall (0%) comes BEFORE highest recall (100%)
    box_red = card_red.bounding_box()
    box_yellow = card_yellow.bounding_box()
    box_green = card_green.bounding_box()
    box_perfect = card_perfect.bounding_box()

    assert box_red is not None and box_yellow is not None and box_green is not None and box_perfect is not None
    assert box_red["y"] < box_yellow["y"] < box_green["y"] < box_perfect["y"], (
        "Wordlist should be sorted ascending by recall rate: Red (0%) -> Yellow (67%) -> Green (80%) -> Perfect (100%)"
    )


def test_wordlist_three_dot_menu_and_delete_word(mobile_page: Page):
    """Test Wordlist Three-Dot Menu & Word Deletion:
    - Click three-dot menu button (⋮).
    - Dropdown menu opens with 'Delete' option.
    - Clicking 'Delete' deletes word and refreshes list.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Create a word specifically to delete via bottom dock
    word_to_delete = "unique_word_to_delete"
    page.locator("#quick-word-input").fill(f"{word_to_delete} - на_удаление")
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(300)

    # Navigate to Wordlist
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-wordlist").click()
    expect(page.locator("#wordlist-view")).to_be_visible()

    # Find the target card
    card = page.locator(f".word-card:has-text('{word_to_delete}')")
    expect(card).to_be_visible()

    # Click the three-dot menu button on this card
    dots_btn = card.locator(".btn-word-dots-menu")
    expect(dots_btn).to_be_visible()
    dots_btn.click()

    # Verify dropdown menu is open and contains Delete button
    dropdown = card.locator(".word-dropdown-menu")
    expect(dropdown).to_be_visible()
    delete_btn = card.locator(".dropdown-item-delete")
    expect(delete_btn).to_be_visible()
    expect(delete_btn).to_contain_text("Delete")

    # Click Delete
    delete_btn.click()

    # Verify card is removed from DOM
    expect(page.locator(f".word-card:has-text('{word_to_delete}')")).to_have_count(0)


def test_wordlist_pagination_controls(mobile_page: Page):
    """Test Wordlist Pagination:
    - When words count exceeds 20 items per page, pagination controls are shown.
    - Clicking Next / Prev transitions between pages.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Create 25 words to exceed 20 items per page
    page.evaluate("""async () => {
        const token = localStorage.getItem('ll_token');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        for (let i = 1; i <= 25; i++) {
            await fetch('/api/v1/words/', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: `paginated_word_${i}`, translation: `перевод_${i}`, language_code: 'en' })
            });
        }
    }""")

    # Navigate to Wordlist
    page.locator("#burger-menu-btn").click()
    page.locator("#nav-link-wordlist").click()
    expect(page.locator("#wordlist-view")).to_be_visible()

    # Verify pagination controls are displayed
    pagination = page.locator(".pagination-controls")
    expect(pagination).to_be_visible()
    expect(page.locator("#pagination-info")).to_contain_text("Page 1 of")

    # Exactly 20 word cards displayed on Page 1
    expect(page.locator(".word-card")).to_have_count(20)

    # Click Next Page
    btn_next = page.locator("#btn-next-page")
    expect(btn_next).to_be_enabled()
    btn_next.click()

    # Page 2 info
    expect(page.locator("#pagination-info")).to_contain_text("Page 2 of")
    # Page 2 cards count > 0 and <= 20
    cards_page2 = page.locator(".word-card").count()
    assert 1 <= cards_page2 <= 20

    # Click Prev Page
    btn_prev = page.locator("#btn-prev-page")
    expect(btn_prev).to_be_enabled()
    btn_prev.click()
    expect(page.locator("#pagination-info")).to_contain_text("Page 1 of")
    expect(page.locator(".word-card")).to_have_count(20)
