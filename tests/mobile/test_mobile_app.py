import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_mobile_layout_and_fixed_elements(mobile_page: Page):
    """Test (a): Mobile Layout & Fixed Elements.
    Header is fixed at top, floating input dock is fixed at bottom,
    middle container scrolls without viewport overscroll.
    """
    page = mobile_page

    # Verify header is rendered at the top
    header = page.locator(".app-header")
    expect(header).to_be_visible()
    header_box = header.bounding_box()
    assert header_box is not None
    assert header_box["y"] == 0, f"Header should start at y=0, got {header_box['y']}"

    # Verify bottom input dock is fixed at the bottom of the viewport
    bottom_dock = page.locator(".bottom-dock")
    expect(bottom_dock).to_be_visible()
    dock_box = bottom_dock.bounding_box()
    assert dock_box is not None
    viewport_size = page.viewport_size
    assert viewport_size is not None
    # Bottom dock should touch or be flush at bottom of viewport
    assert abs((dock_box["y"] + dock_box["height"]) - viewport_size["height"]) < 2

    # Verify bottom dock has fixed positioning in computed styles
    dock_position = bottom_dock.evaluate("el => window.getComputedStyle(el).position")
    assert dock_position == "fixed"

    # Verify middle scroll container (.app-container) has overflow-y: auto / scroll
    container = page.locator(".app-container")
    expect(container).to_be_visible()
    container_overflow_y = container.evaluate("el => window.getComputedStyle(el).overflowY")
    assert container_overflow_y in ("auto", "scroll")

    # Verify html and body prevent viewport overscroll (overflow: hidden, overscroll-behavior: none)
    body_overflow = page.evaluate("() => window.getComputedStyle(document.body).overflow")
    html_overflow = page.evaluate("() => window.getComputedStyle(document.documentElement).overflow")
    assert "hidden" in body_overflow or "hidden" in html_overflow

    # Verify zero horizontal overflow on mobile viewport
    scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
    client_width = page.evaluate("() => document.documentElement.clientWidth")
    assert scroll_width <= client_width, f"Horizontal overflow detected: scrollWidth={scroll_width} > clientWidth={client_width}"

    # Capture initial layout screenshot
    screenshot_path = SCREENSHOTS_DIR / "mobile_layout_initial.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_word_addition_and_flashcard_display(mobile_page: Page):
    """Test (b): Word Addition.
    Authenticate, type into floating bottom dock, submit via send button,
    and verify word appears on flashcard.
    """
    page = mobile_page

    # Log in via Quick Demo button in Auth modal
    btn_login = page.locator("#btn-open-login")
    btn_login.click()

    auth_modal = page.locator("#auth-modal")
    expect(auth_modal).to_have_class(re.compile(r"is-open"))

    quick_demo_btn = page.locator("#quick-demo-btn")
    expect(quick_demo_btn).to_be_visible()
    quick_demo_btn.click()

    # Wait for login completion and modal close
    expect(auth_modal).not_to_have_class(re.compile(r"is-open"))
    expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Type a new word into the floating bottom dock
    word_text = "serendipity"
    word_translation = "счастливая случайность"
    input_text = f"{word_text} - {word_translation}"

    quick_input = page.locator("#quick-word-input")
    expect(quick_input).to_be_visible()
    quick_input.fill(input_text)

    # Submit via send button
    btn_send = page.locator("#btn-quick-send")
    expect(btn_send).to_be_enabled()
    btn_send.click()

    # Verify toast confirmation appears for the added word
    toast = page.locator(".toast", has_text=word_text)
    expect(toast).to_be_visible()

    # Verify the new word is displayed on the active flashcard
    card_word = page.locator("#card-word")
    expect(card_word).to_be_visible()
    expect(card_word).to_have_text(word_text)

    # Capture screenshot of the front flashcard
    screenshot_path = SCREENSHOTS_DIR / "mobile_card_front.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_flashcard_flip_and_srs_buttons_ui(mobile_page: Page):
    """Test (c): Flashcard Flip & SRS buttons styling and layout.
    Verify target word on front, tap to flip, verify translation revealed,
    verify Red ✕ and Green ✓ buttons are visible, correctly styled,
    and strictly within panel/screen bounds with no horizontal overflow.
    """
    page = mobile_page

    # Log in if needed
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add a card if deck is empty
    if page.locator("#empty-state").is_visible():
        page.locator("#quick-word-input").fill("ephemeral - мимолетный")
        page.locator("#btn-quick-send").click()
        expect(page.locator("#card-word")).to_have_text("ephemeral")

    # Target word visible on front
    card = page.locator("#flashcard")
    expect(card).to_be_visible()
    expect(card).not_to_have_class(re.compile(r"is-flipped"))

    # Tap flashcard to flip
    card.click()
    expect(card).to_have_class(re.compile(r"is-flipped"))

    # Verify translation is visible
    translation = page.locator("#card-translation")
    expect(translation).to_be_visible()
    assert len(translation.inner_text().strip()) > 0

    # Locate SRS rating buttons
    ratings_wrapper = page.locator("#srs-ratings-wrapper")
    expect(ratings_wrapper).to_be_visible()

    btn_wrong = page.locator("#btn-srs-wrong")
    btn_correct = page.locator("#btn-srs-correct")

    expect(btn_wrong).to_be_visible()
    expect(btn_correct).to_be_visible()

    # Verify buttons contain clean icons ✕ and ✓ ONLY (no 'Forgot', 'Remembered', '[1]', '[2]')
    wrong_text = btn_wrong.inner_text().strip()
    correct_text = btn_correct.inner_text().strip()

    assert wrong_text == "✕", f"Red button text should only be '✕', got '{wrong_text}'"
    assert correct_text == "✓", f"Green button text should only be '✓', got '{correct_text}'"

    assert "Forgot" not in wrong_text
    assert "[1]" not in wrong_text
    assert "Remembered" not in correct_text
    assert "[2]" not in correct_text

    # Verify button dimensions & styling: circular/rounded action buttons (width ≈ height, 48-56px)
    wrong_box = btn_wrong.bounding_box()
    correct_box = btn_correct.bounding_box()
    assert wrong_box is not None and correct_box is not None

    assert 44 <= wrong_box["width"] <= 60, f"Red button width {wrong_box['width']} should be ~48-56px"
    assert 44 <= wrong_box["height"] <= 60, f"Red button height {wrong_box['height']} should be ~48-56px"
    assert abs(wrong_box["width"] - wrong_box["height"]) <= 4, "Red button should be circular (width ≈ height)"

    assert 44 <= correct_box["width"] <= 60, f"Green button width {correct_box['width']} should be ~48-56px"
    assert 44 <= correct_box["height"] <= 60, f"Green button height {correct_box['height']} should be ~48-56px"
    assert abs(correct_box["width"] - correct_box["height"]) <= 4, "Green button should be circular (width ≈ height)"

    # Verify buttons are centered side-by-side in flex container with gap
    assert wrong_box["x"] + wrong_box["width"] < correct_box["x"], "Buttons should be side-by-side (wrong on left, correct on right)"
    assert abs(wrong_box["y"] - correct_box["y"]) < 5, "Buttons should be aligned on the same horizontal row"

    # Verify border-radius is circular (50% or >= 24px)
    wrong_radius = btn_wrong.evaluate("el => window.getComputedStyle(el).borderRadius")
    correct_radius = btn_correct.evaluate("el => window.getComputedStyle(el).borderRadius")
    assert "50%" in wrong_radius or any(float(p.replace("px", "")) >= 24 for p in wrong_radius.split() if "px" in p)
    assert "50%" in correct_radius or any(float(p.replace("px", "")) >= 24 for p in correct_radius.split() if "px" in p)

    # Verify bounds: strictly within the mobile screen viewport (390px)
    viewport_width = page.viewport_size["width"]
    assert wrong_box["x"] >= 0 and wrong_box["x"] + wrong_box["width"] <= viewport_width
    assert correct_box["x"] >= 0 and correct_box["x"] + correct_box["width"] <= viewport_width

    # Verify zero horizontal overflow on page
    scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
    client_width = page.evaluate("() => document.documentElement.clientWidth")
    assert scroll_width <= client_width

    # Capture screenshot of flipped card with SRS buttons
    screenshot_path = SCREENSHOTS_DIR / "mobile_card_back_srs.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_narrow_mobile_viewport_320px_no_overflow(narrow_mobile_page: Page):
    """Verify that on ultra-narrow mobile viewports (320px width),
    the SRS buttons and all layout elements fit perfectly without horizontal overflow.
    """
    page = narrow_mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add word if needed
    if page.locator("#empty-state").is_visible():
        page.locator("#quick-word-input").fill("gezellig - уютный")
        page.locator("#btn-quick-send").click()
        expect(page.locator("#card-word")).to_have_text("gezellig")

    # Flip card
    page.locator("#flashcard").click()
    expect(page.locator("#flashcard")).to_have_class(re.compile(r"is-flipped"))

    # Check SRS buttons within 320px viewport
    btn_wrong = page.locator("#btn-srs-wrong")
    btn_correct = page.locator("#btn-srs-correct")

    expect(btn_wrong).to_be_visible()
    expect(btn_correct).to_be_visible()

    wrong_box = btn_wrong.bounding_box()
    correct_box = btn_correct.bounding_box()
    assert wrong_box is not None and correct_box is not None

    assert wrong_box["x"] >= 0
    assert correct_box["x"] + correct_box["width"] <= 320

    # Verify zero horizontal overflow
    scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
    client_width = page.evaluate("() => document.documentElement.clientWidth")
    assert scroll_width <= client_width == 320

    # Scroll SRS buttons into view on 320px height
    btn_wrong.scroll_into_view_if_needed()

    # Save screenshot of 320px narrow viewport
    screenshot_path = SCREENSHOTS_DIR / "mobile_narrow_320px.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_srs_review_action_feedback_and_transition(mobile_page: Page):
    """Test (d): SRS Review action.
    Tap ✕ or ✓ and verify transition / feedback.
    """
    page = mobile_page

    # Ensure logged in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add two words for testing review flow
    page.locator("#quick-word-input").fill("cat - кот")
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(300)

    page.locator("#quick-word-input").fill("dog - собака")
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(300)

    # Flip active card
    page.locator("#flashcard").click()
    expect(page.locator("#flashcard")).to_have_class(re.compile(r"is-flipped"))

    # Tap the Green ✓ (Remembered) button
    btn_correct = page.locator("#btn-srs-correct")
    expect(btn_correct).to_be_visible()
    btn_correct.click()

    # Verify toast feedback appears
    toast_good = page.locator(".toast", has_text="✓ Remembered")
    expect(toast_good).to_be_visible()

    # Wait a moment for deck state update
    page.wait_for_timeout(500)

    # Flip the next card and tap Red ✕ (Forgot) button
    if page.locator("#flashcard").is_visible():
        page.locator("#flashcard").click()
        btn_wrong = page.locator("#btn-srs-wrong")
        expect(btn_wrong).to_be_visible()
        btn_wrong.click()

        # Verify toast feedback for Forgot
        toast_wrong = page.locator(".toast", has_text="✕ Forgot")
        expect(toast_wrong).to_be_visible()


def test_visual_screenshots_generated(mobile_page: Page):
    """Test (e): Visual Screenshot Testing.
    Capture and verify mobile screenshot(s) saved to tests/screenshots/.
    """
    expected_screenshots = [
        "mobile_layout_initial.png",
        "mobile_card_front.png",
        "mobile_card_back_srs.png",
        "mobile_narrow_320px.png",
    ]

    for filename in expected_screenshots:
        path = SCREENSHOTS_DIR / filename
        assert path.exists(), f"Expected screenshot {filename} was not generated"
        assert path.stat().st_size > 1000, f"Screenshot {filename} is empty or corrupted ({path.stat().st_size} bytes)"
