---
name: playwright-page-objects
description: Explore a web application using playwright-cli, crawl pages, dialogs, and components, generate TypeScript Playwright Page Object Models (POMs) with smart decomposition heuristics, and maintain an operations GRAPH.md.
allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)
---

# Playwright Page Objects & App Explorer

Autonomously explore a running web application using `playwright-cli`, discover pages, dialogs, and components, generate production-ready TypeScript Playwright Page Object Models (POMs), and maintain a visual navigation and operations graph in `GRAPH.md`.

---

## When to Use This Skill

Activate this skill when:
- Asked to "explore the app", "crawl the app", or "map the UI".
- Asked to create or update Page Object Models (POMs) for an application or feature.
- Asked to generate or update `GRAPH.md` describing page operations, routes, and transitions.
- Refactoring Playwright tests to use Page Objects and reusable components.

---

## Architecture & Directory Conventions

Unless the user specifies a custom path, organize page objects and documentation in the testing directory:

```text
<pages_dir>/                      # Default: tests/e2e/pages/
├── GRAPH.md                      # Visual state machine & operations catalog
├── BasePage.ts                   # Common base page with shared navigation & locators
├── BaseComponent.ts              # Common base component scoped to a Locator or Page
├── components/                   # Reusable or large components (>50% of page)
│   ├── HeaderComponent.ts
│   ├── BottomDockComponent.ts
│   └── BurgerMenuDrawer.ts
├── dialogs/                      # Popups, modals, alerts, drawers
│   ├── ProfileSwitcherModal.ts
│   └── ConfirmDialog.ts
└── views/ (or root of pages/)    # Primary page views
    ├── AuthPage.ts
    ├── LessonsPage.ts
    ├── FlashcardsPage.ts
    └── WordlistPage.ts
```

---

## Core Workflow

### Phase 1: Environment & Base Setup

1. **Verify Target Application**:
   - Ensure backend and frontend dev servers are running (e.g. `http://localhost:5173` or `http://127.0.0.1:8899`).
   - Determine target pages directory (default: `tests/e2e/pages/`).
2. **Create Foundation Classes** (if not already present):
   - Scaffold `BasePage.ts` and `BaseComponent.ts` following [POM Conventions](./references/pom-conventions.md).
3. **Launch Explorer Session**:
   - Start browser: `playwright-cli open <base_url>`
   - Take initial snapshot: `playwright-cli snapshot`

---

### Phase 2: Systematic Crawl & State Discovery

Follow the detailed runbook in [Crawler Workflow](./references/crawler-workflow.md):

1. **Snapshot Current View**:
   - Run `playwright-cli snapshot` to capture DOM structure, roles, text, and interactive elements.
   - Inspect key landmarks: headings, navigation bars, action buttons, inputs.
2. **Identify Elements & Transitions**:
   - For links, tabs, and navigation items: note target view or URL change.
   - For buttons opening modals/drawers: note overlay appearance (`#burger-menu-drawer`, modal backdrops).
   - Use `playwright-cli eval "el => el.id"` or `getAttribute('data-testid')` to identify stable selectors.
3. **Interact & Transition**:
   - Exercise navigation: `playwright-cli click <ref>`.
   - Record the transition in memory: `SourcePage --[Action]--> DestinationPage`.
   - Take a new snapshot to confirm destination state.
   - Use `playwright-cli go-back` or direct navigation when needed to resume exploration.
4. **Prevent Infinite Crawl Loops**:
   - Maintain a set of visited page signatures (by route/URL and primary view container ID).
   - Do not re-explore forms or destructive actions unless verifying specific flows.

---

### Phase 3: POM Decomposition Heuristics

Follow these strict rules to decide what files to create:

#### 1. Page Object (`<PageName>Page.ts`)
Create a dedicated Page Object for every distinct top-level route or view container:
- Identified by unique view container (e.g. `#auth-view`, `#lessons-view`, `#flashcards-view`, `#wordlist-view`).
- Extends `BasePage`.
- Contains view-specific locators, data-fetching expectations, and primary user workflows.

#### 2. Component Object (`<ComponentName>Component.ts`)
Extract an element into its own component file under `components/` if:
- **Reuse Criterion**: The UI element is shared across 2 or more distinct pages (e.g. `Header`, `BottomDock`, `NotificationToast`).
- **Complexity Criterion**: The element occupies **more than half (>50%)** of the page object's locators or business logic (e.g. `LessonExerciseSection`, `FlashcardPlayer`, `WordGridTable`).
- Extends `BaseComponent`. Instantiated directly on parent Page Objects via composition:
  ```typescript
  export class LessonsPage extends BasePage {
    readonly header = new HeaderComponent(this.page);
    readonly dock = new BottomDockComponent(this.page);
  }
  ```

#### 3. Popup / Dialog / Drawer Object (`<DialogName>Dialog.ts`)
Extract into `dialogs/` (or `components/`) for:
- Any modal dialog (`dialog`, `.modal`, `.modal-backdrop`).
- Slide-out drawers (e.g. `BurgerMenuDrawer`).
- Confirmation prompts or popovers (e.g. `ProfileSwitcherModal`).
- Must provide lifecycle methods: `expectOpen()`, `close()`, `confirm()`, `cancel()`.

---

### Phase 4: Code Generation Standards

All generated POM classes must strictly adhere to [POM Conventions](./references/pom-conventions.md):
- **Language**: TypeScript.
- **Locator Strategy Priority**:
  1. Semantic Playwright locators: `page.getByRole(...)`, `page.getByLabel(...)`, `page.getByText(...)`.
  2. Unique IDs / Test IDs: `page.locator('#btn-login-submit')`, `page.getByTestId(...)`.
  3. Stable CSS selectors (avoid deeply nested or fragile positional paths).
- **Methods**:
  - Encapsulate user actions (e.g. `fillCredentials(username, password)`, `selectTab('register')`, `clickCreateLesson()`).
  - Encapsulate page state assertions (e.g. `expectLoaded()`, `expectErrorMessage(text)`).
  - Return typed destinations on navigation transitions where appropriate.

---

### Phase 5: Maintain `GRAPH.md`

Every exploration run must create or update `<pages_dir>/GRAPH.md` following [Graph Format](./references/graph-format.md):
1. **Mermaid Flowchart / State Diagram**:
   - Visualizes all discovered pages, drawers, and modal dialogs.
   - Edges label the user actions that trigger transitions.
2. **Pages & Views Catalog**:
   - Route/ID, corresponding POM file, short description.
   - Bulleted list of all user operations possible on that page.
   - Outgoing transitions and opening modals.
3. **Components & Dialogs Catalog**:
   - Component name, host pages, key actions.

---

## Detailed References

- [Crawler Workflow Runbook](./references/crawler-workflow.md): Commands, inspection techniques, and crawl safety.
- [POM Conventions & Templates](./references/pom-conventions.md): TypeScript class templates for BasePage, Pages, Components, and Dialogs.
- [GRAPH.md Format & Specification](./references/graph-format.md): Markdown & Mermaid template for the navigation graph.
