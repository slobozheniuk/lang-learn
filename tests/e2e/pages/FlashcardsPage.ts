import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BurgerMenuDrawer } from './components/BurgerMenuDrawer';
import { BottomDockComponent } from './components/BottomDockComponent';

export class FlashcardsPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#flashcards-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly drawer = new BurgerMenuDrawer(this.page);
  readonly dock = new BottomDockComponent(this.page);

  // Flashcard Scene
  readonly scene: Locator = this.root.locator('#flashcard-scene');
  readonly flashcard: Locator = this.root.locator('#flashcard');
  readonly cardWord: Locator = this.root.locator('#card-word');
  readonly cardPhonetic: Locator = this.root.locator('#card-phonetic');
  readonly cardTranslation: Locator = this.root.locator('#card-translation');
  readonly cardContext: Locator = this.root.locator('#card-context');

  // Review Actions
  readonly ratingsWrapper: Locator = this.root.locator('#srs-ratings-wrapper');
  readonly btnAgain: Locator = this.root.locator('#btn-srs-wrong');
  readonly btnAudio: Locator = this.root.locator('#btn-audio');
  readonly btnGood: Locator = this.root.locator('#btn-srs-correct');

  // Empty / Complete State
  readonly emptyState: Locator = this.root.locator('#empty-state');
  readonly emptyTitle: Locator = this.root.locator('#empty-title');
  readonly emptyDesc: Locator = this.root.locator('#empty-desc');
  readonly btnRestartDeck: Locator = this.root.locator('#btn-restart-deck');

  async flipCard(): Promise<void> {
    await this.flashcard.click();
    // Wait for the 500ms CSS transform transition to finish
    await this.page.waitForTimeout(550);
  }

  async rateAgain(): Promise<void> {
    await this.btnAgain.click();
  }

  async rateGood(): Promise<void> {
    await this.btnGood.click();
  }

  async pronounce(): Promise<void> {
    await this.btnAudio.click();
  }

  async restartDeck(): Promise<void> {
    await this.btnRestartDeck.click();
    await expect(this.flashcard).toBeVisible();
  }

  async expectCardWord(word: string): Promise<void> {
    await expect(this.cardWord).toHaveText(word);
  }

  async expectCardTranslation(translation: string): Promise<void> {
    await expect(this.cardTranslation).toHaveText(translation);
  }

  async expectSessionCompleted(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.emptyTitle).toHaveText('Session Complete!');
  }
}
