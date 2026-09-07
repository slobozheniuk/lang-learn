import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BurgerMenuDrawer } from './components/BurgerMenuDrawer';
import { BottomDockComponent } from './components/BottomDockComponent';

export class WordlistPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#wordlist-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly drawer = new BurgerMenuDrawer(this.page);
  readonly dock = new BottomDockComponent(this.page);

  // View Elements
  readonly emptyState: Locator = this.root.locator('#wordlist-empty');
  readonly grid: Locator = this.root.locator('#wordlist-grid');
  readonly wordCards: Locator = this.root.locator('.word-card');

  // Pagination
  readonly pagination: Locator = this.root.locator('.pagination-controls');
  readonly btnPrevPage: Locator = this.root.locator('#btn-prev-page');
  readonly btnNextPage: Locator = this.root.locator('#btn-next-page');
  readonly paginationInfo: Locator = this.root.locator('#pagination-info');

  async expectEmpty(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.wordCards).toHaveCount(0);
  }

  async getWordCount(): Promise<number> {
    return await this.wordCards.count();
  }

  getWordCard(textOrIndex: string | number): Locator {
    if (typeof textOrIndex === 'number') {
      return this.wordCards.nth(textOrIndex);
    }
    return this.root.locator(`.word-card:has-text('${textOrIndex}')`);
  }

  getCardRecallBadge(card: Locator): Locator {
    return card.locator('.word-recall-badge');
  }

  getCardWord(card: Locator): Locator {
    return card.locator('.word-text-bold strong');
  }

  getCardTranslation(card: Locator): Locator {
    return card.locator('.word-translation-sub');
  }

  getCardDropdown(card: Locator): Locator {
    return card.locator('.word-dropdown-menu');
  }

  getCardDeleteBtn(card: Locator): Locator {
    return card.locator('.dropdown-item-delete');
  }

  getCardDotsBtn(card: Locator): Locator {
    return card.locator('.btn-word-dots-menu');
  }

  async openWordMenu(textOrIndex: string | number): Promise<void> {
    const card = this.getWordCard(textOrIndex);
    await this.getCardDotsBtn(card).click();
    await expect(this.getCardDropdown(card)).toBeVisible();
  }

  async deleteWord(textOrIndex: string | number): Promise<void> {
    const card = this.getWordCard(textOrIndex);
    await this.openWordMenu(textOrIndex);
    await this.getCardDeleteBtn(card).click();
  }

  async getRecallRate(textOrIndex: string | number): Promise<string> {
    const card = this.getWordCard(textOrIndex);
    return (await this.getCardRecallBadge(card).innerText()).trim();
  }

  async nextPage(): Promise<void> {
    await this.btnNextPage.scrollIntoViewIfNeeded();
    await this.btnNextPage.click();
  }

  async prevPage(): Promise<void> {
    await this.btnPrevPage.scrollIntoViewIfNeeded();
    await this.btnPrevPage.click();
  }
}
