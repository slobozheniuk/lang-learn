import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  abstract readonly url: string;
  abstract readonly root: Locator;
  readonly appContainer: Locator;
  readonly toast: Locator;

  constructor(readonly page: Page) {
    this.appContainer = this.page.locator('.app-container');
    this.toast = this.page.locator('.toast');
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await this.root.waitFor({ state: 'visible' });
  }

  async expectHidden(): Promise<void> {
    await this.root.waitFor({ state: 'hidden' });
  }
}
