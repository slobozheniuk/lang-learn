import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class HeaderComponent extends BaseComponent {
  readonly btnBurger: Locator = this.root.locator('#burger-menu-btn');
  readonly brandLink: Locator = this.root.locator('.brand');
  readonly btnProfileSwitcher: Locator = this.root.locator('#profile-switcher-btn');
  readonly btnSettings: Locator = this.root.locator('#btn-settings');
  readonly pageTitle: Locator = this.root.locator('#page-title');

  constructor(page: Page) {
    super(page, page.locator('.app-header'));
  }

  async openBurgerMenu(): Promise<void> {
    await this.btnBurger.click();
  }

  async openMenu(): Promise<void> {
    await this.openBurgerMenu();
  }

  async clickBrand(): Promise<void> {
    await this.brandLink.click();
  }

  async openSettings(): Promise<void> {
    await this.btnSettings.click();
  }

  async openProfileSwitcher(): Promise<void> {
    await this.btnProfileSwitcher.click();
  }

  async expectAuthenticated(): Promise<void> {
    await expect(this.btnBurger).toBeVisible();
    await expect(this.btnSettings).toBeVisible();
  }

  async expectUnauthenticated(): Promise<void> {
    await expect(this.btnBurger).toHaveCount(0);
    await expect(this.btnSettings).toHaveCount(0);
  }
}
