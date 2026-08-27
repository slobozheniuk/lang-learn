import re
from pathlib import Path
import pytest
from playwright.sync_api import Page, expect

SCREENSHOTS_DIR = Path("tests/screenshots")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def test_mobile_layout_and_fixed_elements(mobile_page: Page):
    """Test Layout & Fixed Elements:
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


def test_auth_modal_open_tabs_and_close(mobile_page: Page):
    """Behavior (a): Clicking sign in button opens modal,
    supports tab switching and close button.
    """
    page = mobile_page

    btn_login = page.locator("#btn-open-login")
    expect(btn_login).to_be_visible()
    btn_login.click()

    auth_modal = page.locator("#auth-modal")
    expect(auth_modal).to_have_class(re.compile(r"(is-open|open|active|show)"))

    # Test tab switching to Register
    tab_register = page.locator("#tab-register")
    expect(tab_register).to_be_visible()
    tab_register.click()
    expect(page.locator("#register-form")).to_be_visible()
    expect(page.locator("#login-form")).not_to_be_visible()

    # Test tab switching back to Sign In
    tab_login = page.locator("#tab-login")
    expect(tab_login).to_be_visible()
    tab_login.click()
    expect(page.locator("#login-form")).to_be_visible()
    expect(page.locator("#register-form")).not_to_be_visible()

    # Test close button
    close_btn = page.locator("#modal-close-btn")
    expect(close_btn).to_be_visible()
    close_btn.click()
    expect(auth_modal).not_to_have_class(re.compile(r"is-open"))


def test_card_flip_front_to_back_and_reverse(mobile_page: Page):
    """Behavior (b): Clicking card flips it (verifying front -> back flip transition
    and back -> front flip transition).
    """
    page = mobile_page

    # Log in if needed
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add a card if deck is empty
    if page.locator("#empty-state").is_visible():
        page.locator("#quick-word-input").fill("luminary - светило")
        page.locator("#btn-quick-send").click()
        expect(page.locator("#card-word")).to_have_text("luminary")

    card = page.locator("#flashcard")
    expect(card).to_be_visible()
    expect(card).not_to_have_class(re.compile(r"(is-flipped|flipped)"))

    # Tap flashcard to flip front -> back
    card.click()
    expect(card).to_have_class(re.compile(r"(is-flipped|flipped)"))

    # Verify translation is visible on back face
    translation = page.locator("#card-translation")
    expect(translation).to_be_visible()
    assert len(translation.inner_text().strip()) > 0

    # Tap flashcard again to flip back -> front
    card.click()
    expect(card).not_to_have_class(re.compile(r"(is-flipped|flipped)"))
    expect(page.locator("#card-word")).to_be_visible()


def test_sound_button_triggers_speech_synthesis(mobile_page: Page):
    """Behavior (c): Clicking sound button triggers Web Speech API
    (mocked/spied SpeechSynthesis).
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add a known word
    test_word = "sonder"
    page.locator("#quick-word-input").fill(f"{test_word} - осознание")
    page.locator("#btn-quick-send").click()
    expect(page.locator("#card-word")).to_have_text(test_word)

    # Set up spy on window.speechSynthesis
    page.evaluate("""() => {
        window.__spokenUtterances = [];
        const origSpeak = window.speechSynthesis ? window.speechSynthesis.speak.bind(window.speechSynthesis) : null;
        if (!window.speechSynthesis) {
            window.speechSynthesis = {
                speak: (u) => { window.__spokenUtterances.push({ text: u.text, lang: u.lang }); },
                cancel: () => {},
                resume: () => {},
                paused: false
            };
        } else {
            window.speechSynthesis.speak = (u) => {
                window.__spokenUtterances.push({ text: u.text, lang: u.lang });
                if (origSpeak) {
                    try { origSpeak(u); } catch(e) {}
                }
            };
        }
    }""")

    # Click sound button
    btn_audio = page.locator("#btn-audio")
    expect(btn_audio).to_be_visible()
    btn_audio.click()

    # Verify speech synthesis was called with current card's word text
    spoken = page.evaluate("() => window.__spokenUtterances")
    assert len(spoken) >= 1, f"Expected speechSynthesis.speak to be called, got {spoken}"
    assert spoken[-1]["text"] == test_word, f"Expected spoken text '{test_word}', got '{spoken[-1]['text']}'"
    assert "en" in spoken[-1]["lang"].lower(), f"Expected English lang code, got '{spoken[-1]['lang']}'"


def test_srs_buttons_submission_and_no_sticky_focus(mobile_page: Page):
    """Behavior (d): Clicking V or X submits review, transitions,
    and does not leave sticky persistent focus highlight styles.
    """
    page = mobile_page

    # Log in
    if page.locator("#btn-open-login").is_visible():
        page.locator("#btn-open-login").click()
        page.locator("#quick-demo-btn").click()
        expect(page.locator("#auth-nav")).to_contain_text("demo_student")

    # Add two words for testing
    page.locator("#quick-word-input").fill("apple - яблоко")
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(300)

    page.locator("#quick-word-input").fill("banana - банан")
    page.locator("#btn-quick-send").click()
    page.wait_for_timeout(300)

    # Flip card
    page.locator("#flashcard").click()
    expect(page.locator("#flashcard")).to_have_class(re.compile(r"is-flipped"))

    btn_correct = page.locator("#btn-srs-correct")
    btn_wrong = page.locator("#btn-srs-wrong")
    expect(btn_correct).to_be_visible()
    expect(btn_wrong).to_be_visible()

    # Click Green ✓
    btn_correct.click()

    # Verify button is blurred and not retaining document.activeElement focus
    is_active_correct = btn_correct.evaluate("el => document.activeElement === el")
    assert not is_active_correct, "Green ✓ button should be blurred after click (no sticky focus)"

    # Wait for deck queue transition
    page.wait_for_timeout(400)

    # Flip next card and click Red ✕
    if page.locator("#flashcard").is_visible():
        page.locator("#flashcard").click()
        btn_wrong.click()
        is_active_wrong = btn_wrong.evaluate("el => document.activeElement === el")
        assert not is_active_wrong, "Red ✕ button should be blurred after click (no sticky focus)"


def test_word_addition_and_flashcard_display(mobile_page: Page):
    """Behavior (e): Adding a word via bottom dock creates word
    and shows it immediately on flashcard, resetting empty state.
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

    # Verify no floating toast bubbles appear and the new word is displayed on the active flashcard
    expect(page.locator(".toast")).to_have_count(0)
    card_word = page.locator("#card-word")
    expect(card_word).to_be_visible()
    expect(card_word).to_have_text(word_text)

    # Verify input field is cleared
    expect(quick_input).to_have_value("")

    # Verify empty state is hidden
    expect(page.locator("#empty-state")).not_to_be_visible()

    # Capture screenshot of the front flashcard
    screenshot_path = SCREENSHOTS_DIR / "mobile_card_front.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_flashcard_flip_and_srs_buttons_ui(mobile_page: Page):
    """Test: Flashcard Flip & SRS buttons styling and layout.
    Verify target word on front, tap to flip, verify translation revealed,
    verify Red ✕, Audio 🔊, and Green ✓ buttons are visible, correctly styled,
    and strictly within screen bounds with no horizontal overflow.
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

    # Locate control action buttons
    ratings_wrapper = page.locator("#srs-ratings-wrapper")
    expect(ratings_wrapper).to_be_visible()

    btn_wrong = page.locator("#btn-srs-wrong")
    btn_audio = page.locator("#btn-audio")
    btn_correct = page.locator("#btn-srs-correct")

    expect(btn_wrong).to_be_visible()
    expect(btn_audio).to_be_visible()
    expect(btn_correct).to_be_visible()

    # Verify buttons contain clean icons ✕, 🔊, and ✓ ONLY
    wrong_text = btn_wrong.inner_text().strip()
    audio_text = btn_audio.inner_text().strip()
    correct_text = btn_correct.inner_text().strip()

    assert wrong_text == "✕", f"Red button text should only be '✕', got '{wrong_text}'"
    assert audio_text == "🔊", f"Audio button text should only be '🔊', got '{audio_text}'"
    assert correct_text == "✓", f"Green button text should only be '✓', got '{correct_text}'"

    # Verify button dimensions & styling: circular action buttons (width ≈ height, 44-60px)
    wrong_box = btn_wrong.bounding_box()
    audio_box = btn_audio.bounding_box()
    correct_box = btn_correct.bounding_box()
    assert wrong_box is not None and audio_box is not None and correct_box is not None

    for name, box in [("Red ✕", wrong_box), ("Audio 🔊", audio_box), ("Green ✓", correct_box)]:
        assert 44 <= box["width"] <= 60, f"{name} button width {box['width']} should be ~48-56px"
        assert 44 <= box["height"] <= 60, f"{name} button height {box['height']} should be ~48-56px"
        assert abs(box["width"] - box["height"]) <= 4, f"{name} button should be circular (width ≈ height)"

    # Verify buttons are centered side-by-side in row: ✕ on left, 🔊 in middle, ✓ on right
    assert wrong_box["x"] + wrong_box["width"] < audio_box["x"], "Red ✕ should be to the left of Audio 🔊"
    assert audio_box["x"] + audio_box["width"] < correct_box["x"], "Audio 🔊 should be to the left of Green ✓"
    assert abs(wrong_box["y"] - audio_box["y"]) < 5, "Buttons should be aligned on the same horizontal row"
    assert abs(audio_box["y"] - correct_box["y"]) < 5, "Buttons should be aligned on the same horizontal row"

    # Verify border-radius is circular (50% or >= 24px)
    for btn in [btn_wrong, btn_audio, btn_correct]:
        radius = btn.evaluate("el => window.getComputedStyle(el).borderRadius")
        assert "50%" in radius or any(float(p.replace("px", "")) >= 24 for p in radius.split() if "px" in p)

    # Verify bounds: strictly within the mobile screen viewport (390px)
    viewport_width = page.viewport_size["width"]
    assert wrong_box["x"] >= 0 and wrong_box["x"] + wrong_box["width"] <= viewport_width
    assert audio_box["x"] >= 0 and audio_box["x"] + audio_box["width"] <= viewport_width
    assert correct_box["x"] >= 0 and correct_box["x"] + correct_box["width"] <= viewport_width

    # Verify zero horizontal overflow on page
    scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
    client_width = page.evaluate("() => document.documentElement.clientWidth")
    assert scroll_width <= client_width

    # Capture screenshot of flipped card with action buttons
    screenshot_path = SCREENSHOTS_DIR / "mobile_card_back_srs.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_narrow_mobile_viewport_320px_no_overflow(narrow_mobile_page: Page):
    """Verify that on ultra-narrow mobile viewports (320px width),
    the 3 action buttons and all layout elements fit perfectly without horizontal overflow.
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

    # Check 3 action buttons within 320px viewport
    btn_wrong = page.locator("#btn-srs-wrong")
    btn_audio = page.locator("#btn-audio")
    btn_correct = page.locator("#btn-srs-correct")

    expect(btn_wrong).to_be_visible()
    expect(btn_audio).to_be_visible()
    expect(btn_correct).to_be_visible()

    wrong_box = btn_wrong.bounding_box()
    audio_box = btn_audio.bounding_box()
    correct_box = btn_correct.bounding_box()
    assert wrong_box is not None and audio_box is not None and correct_box is not None

    assert wrong_box["x"] >= 0
    assert audio_box["x"] > wrong_box["x"]
    assert correct_box["x"] + correct_box["width"] <= 320

    # Verify zero horizontal overflow
    scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
    client_width = page.evaluate("() => document.documentElement.clientWidth")
    assert scroll_width <= client_width == 320

    # Scroll action buttons into view on 320px height
    btn_wrong.scroll_into_view_if_needed()

    # Save screenshot of 320px narrow viewport
    screenshot_path = SCREENSHOTS_DIR / "mobile_narrow_320px.png"
    page.screenshot(path=str(screenshot_path))
    assert screenshot_path.exists() and screenshot_path.stat().st_size > 0


def test_visual_screenshots_generated(mobile_page: Page):
    """Visual Screenshot Testing:
    Verify mobile screenshots saved to tests/screenshots/.
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
