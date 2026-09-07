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
