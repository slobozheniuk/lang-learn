# Playwright Crawler Workflow

This guide details how an agent should use `playwright-cli` to systematically explore and map an application.

---

## 1. Starting the Session

```bash
# Open browser and navigate to the application entry point
playwright-cli open http://localhost:5173/

# Set a standard desktop or mobile viewport depending on requirements
playwright-cli resize 1280 800
```

---

## 2. Capturing and Analyzing View State

After any navigation or interaction, always capture a fresh DOM snapshot:

```bash
playwright-cli snapshot
```

From the snapshot output, extract:
- **Root View Container**: Look for top-level wrappers like `<main>`, `#auth-view`, `#lessons-view`, `div[role="region"]`.
- **Headings & Titles**: Identify page context via `h1`, `h2`, or document title:
  ```bash
  playwright-cli eval "document.title"
  ```
- **Navigation Controls**:
  - Global header navigation: links, buttons, avatar, profile selector.
  - Burger menu / drawer toggles: e.g. `#burger-menu-btn`.
  - Mobile bottom dock: e.g. `#bottom-dock`.
- **Interactive Controls**:
  - Forms, inputs, buttons, checkboxes, dropdowns.

---

## 3. Selector Discovery & Stable Locator Identification

Avoid using ephemeral snapshot ref IDs (like `e12`) directly in Page Object code. Instead, determine stable attributes using `eval`:

```bash
# Check if element has an ID
playwright-cli eval "el => el.id" e12

# Check data-testid attribute
playwright-cli eval "el => el.getAttribute('data-testid')" e12

# Check aria-label or role
playwright-cli eval "el => ({ role: el.getAttribute('role'), label: el.getAttribute('aria-label') })" e12

# Inspect class names and text content
playwright-cli eval "el => ({ class: el.className, text: el.textContent.trim() })" e12
```

---

## 4. Crawling Navigation & Transitions

To discover the app graph, follow this exploration loop:

1. **Record Current State**:
   - Save the current URL, view container ID, and active heading.
2. **Find Clickable Navigation Targets**:
   ```bash
   # Search for specific navigation items
   playwright-cli find "Lessons"
   playwright-cli find "Flashcards"
   playwright-cli find "Wordlist"
   ```
3. **Execute Click**:
   ```bash
   playwright-cli click <ref>
   ```
4. **Inspect State Delta**:
   ```bash
   playwright-cli snapshot
   ```
   - Did the URL change?
   - Did the main view container change (e.g. from `#lessons-view` to `#flashcards-view`)?
   - If yes: Record edge: `SourceView --[Click "Flashcards"]--> FlashcardsView`.
5. **Backtracking**:
   - If navigated to a sub-page, return using `playwright-cli go-back` or click the back/home button to continue exploring other branches.

---

## 5. Handling Modals, Dialogs, and Drawers

When an action opens an overlay (drawer or modal):
1. Notice the modal/drawer backdrop or container appearing in `playwright-cli snapshot`.
2. Inspect the dialog title, inputs, and action buttons.
3. Test dismissal methods:
   - Click close button: `playwright-cli click <close_ref>`
   - Click backdrop (outside dialog):
     ```bash
     playwright-cli mousemove 10 10
     playwright-cli mousedown
     playwright-cli mouseup
     ```
   - Press Escape: `playwright-cli press Escape`
4. Confirm closure in snapshot before proceeding.

---

## 6. Safe Exploration Guidelines

- **Do not submit destructive actions blindly**: Do not click "Delete Account", "Purge Database", or bulk-delete items unless running in an isolated disposable test database.
- **Authentication Handling**:
  - If landing on a login screen, perform login first with test credentials (e.g. `test-0` / `test-0`), snapshot the authenticated landing view, and proceed with internal app exploration.
- **Form Exploration**:
  - Fill dummy inputs to check validation messages (`playwright-cli fill <ref> "test"`).
- **Session Cleanup**:
  - When exploration is finished, always close the browser:
    ```bash
    playwright-cli close
    ```
