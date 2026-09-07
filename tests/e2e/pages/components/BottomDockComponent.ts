import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class BottomDockComponent extends BaseComponent {
  readonly form: Locator = this.root.locator('#quick-word-form');
  readonly input: Locator = this.root.locator('#quick-word-input');
  readonly btnSend: Locator = this.root.locator('#btn-quick-send');
  readonly multiSentenceModal: Locator = this.page.locator('#multi-sentence-modal');

  constructor(page: Page) {
    super(page, page.locator('.bottom-dock'));
  }

  async addWordOrText(text: string, submitVia = 'button'): Promise<void> {
    await this.input.fill(text);
    if (submitVia === 'enter') {
      await this.input.press('Enter');
    } else {
      await this.btnSend.click();
    }
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    await expect(this.root).toHaveCount(0);
  }
}
