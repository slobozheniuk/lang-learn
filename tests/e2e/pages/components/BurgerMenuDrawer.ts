import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export type NavigationTarget = 'lessons' | 'flashcards' | 'wordlist' | 'settings';

export class BurgerMenuDrawer extends BaseComponent {
  readonly backdrop: Locator = this.page.locator('#menu-backdrop');
  readonly closeBtn: Locator = this.root.locator('#drawer-close-btn');
  readonly drawerHeader: Locator = this.root.locator('.drawer-header');
  readonly navLessons: Locator = this.root.locator('#nav-link-lessons');
  readonly navFlashcards: Locator = this.root.locator('#nav-link-flashcards');
  readonly navWordlist: Locator = this.root.locator('#nav-link-wordlist');
  readonly navSettings: Locator = this.root.locator('#nav-link-settings');

  constructor(page: Page) {
    super(page, page.locator('#burger-menu-drawer'));
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toHaveClass(/(is-open|open|active)/);
  }

  async expectClosed(): Promise<void> {
    await expect(this.root).not.toHaveClass(/is-open/);
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.expectClosed();
  }

  async closeViaBackdrop(clickPosition = { x: 330, y: 200 }): Promise<void> {
    await this.backdrop.click({ position: clickPosition });
    await this.expectClosed();
  }

  async closeViaEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.expectClosed();
  }

  async navigateTo(target: NavigationTarget): Promise<void> {
    switch (target) {
      case 'lessons':
        await this.navLessons.click();
        break;
      case 'flashcards':
        await this.navFlashcards.click();
        break;
      case 'wordlist':
        await this.navWordlist.click();
        break;
      case 'settings':
        await this.navSettings.click();
        break;
    }
    await this.expectClosed();
  }
}
