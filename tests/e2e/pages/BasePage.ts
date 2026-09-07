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

  async expectHidden(): Promise<void> {
    await this.root.waitFor({ state: 'hidden' });
  }
}
