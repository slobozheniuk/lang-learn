# Page Object Model (POM) Conventions & Templates

This reference documents the TypeScript conventions and templates to follow when generating Page Objects, Components, and Dialogs.

---

## 1. Core Principles

1. **Composition over inheritance**: Pages compose reusable components (Header, Dock, Drawers).
2. **Encapsulation**: Tests should interact with business-level actions (`fillSearch(...)`, `submitLogin(...)`), not raw locator manipulation.
3. **Resilient Locators**: Prefer semantic roles, labels, and clean IDs/test IDs over brittle structural CSS selectors.
4. **Independent Scoping**: Components accept a parent `Page` or `Locator` as their root, making them modular and nestable.

---

## 2. Base Classes

### `BasePage.ts`
```typescript
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(readonly page: Page) {}

  abstract readonly url: string;
  abstract readonly root: Locator;

  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await this.root.waitFor({ state: 'visible' });
  }
}
```

### `BaseComponent.ts`
```typescript
import { Page, Locator } from '@playwright/test';

export abstract class BaseComponent {
  constructor(
    readonly page: Page,
    readonly root: Locator
  ) {}

  async expectVisible(): Promise<void> {
    await this.root.waitFor({ state: 'visible' });
  }

  async expectHidden(): Promise<void> {
    await this.root.waitFor({ state: 'hidden' });
  }
}
```

---

## 3. Page Object Template

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BottomDockComponent } from './components/BottomDockComponent';

export class LessonsPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#lessons-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly dock = new BottomDockComponent(this.page);

  // View-specific locators
  readonly inputPrompt: Locator = this.page.locator('#lesson-prompt-input');
  readonly btnGenerate: Locator = this.page.locator('#btn-generate-lesson');
  readonly lessonCards: Locator = this.page.locator('.lesson-card');

  async generateLesson(prompt: string): Promise<void> {
    await this.inputPrompt.fill(prompt);
    await this.btnGenerate.click();
  }

  async openLesson(index: number): Promise<void> {
    await this.lessonCards.nth(index).click();
  }

  async expectLessonCount(count: number): Promise<void> {
    await expect(this.lessonCards).toHaveCount(count);
  }
}
```

---

## 4. Reusable Component Template

Use for elements shared across multiple views (e.g. Header, Bottom Dock, Navigation Bar):

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class HeaderComponent extends BaseComponent {
  readonly btnBurger: Locator = this.root.locator('#burger-menu-btn');
  readonly profileBadge: Locator = this.root.locator('#profile-switcher-badge');

  constructor(page: Page) {
    super(page, page.locator('#app-header'));
  }

  async openBurgerMenu(): Promise<void> {
    await this.btnBurger.click();
  }

  async openProfileSwitcher(): Promise<void> {
    await this.profileBadge.click();
  }
}
```

---

## 5. Large / Complex Component Template (>50% of Page)

Extract into `components/` when an element contains deep internal logic, multiple steps, or takes up more than half of the page definition:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class LessonExerciseSection extends BaseComponent {
  readonly exerciseContainer: Locator = this.root.locator('.exercise-item');
  readonly options: Locator = this.root.locator('.exercise-option');
  readonly btnSubmitAnswer: Locator = this.root.locator('#btn-submit-answer');
  readonly feedbackBanner: Locator = this.root.locator('.exercise-feedback');

  constructor(page: Page) {
    super(page, page.locator('#lesson-exercises-section'));
  }

  async selectOption(text: string): Promise<void> {
    await this.options.filter({ hasText: text }).click();
  }

  async submit(): Promise<void> {
    await this.btnSubmitAnswer.click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.feedbackBanner).toHaveClass(/success/);
  }
}
```

---

## 6. Popup / Dialog / Drawer Template

Use for overlays, modal dialogs, drawers, and confirmation popups:

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class ProfileSwitcherModal extends BaseComponent {
  readonly closeBtn: Locator = this.root.locator('#modal-close-btn');
  readonly profileList: Locator = this.root.locator('.profile-option');
  readonly btnAddNewProfile: Locator = this.root.locator('#btn-add-profile');

  constructor(page: Page) {
    super(page, page.locator('#profile-switcher-modal'));
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async selectProfile(languagePair: string): Promise<void> {
    await this.profileList.filter({ hasText: languagePair }).click();
    await this.expectClosed();
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.expectClosed();
  }

  async expectClosed(): Promise<void> {
    await expect(this.root).toHaveCount(0);
  }
}
```
