import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type LessonStudyMode = 'reading' | 'quiz' | 'cards' | 'list';

export class LessonDetailPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#lesson-detail-view');

  // Header & Mode Controls
  readonly btnClose: Locator = this.root.locator('#btn-close-lesson');
  readonly title: Locator = this.root.locator('.lesson-detail-title');
  readonly btnModeReading: Locator = this.root.locator('#btn-mode-reading');
  readonly btnModeQuiz: Locator = this.root.locator('#btn-mode-quiz');
  readonly btnModeCards: Locator = this.root.locator('#btn-mode-cards');
  readonly btnModeList: Locator = this.root.locator('#btn-mode-list');

  // Interactive Reading Mode
  readonly readingContainer: Locator = this.root.locator('#reading-study-container');
  readonly readingChunks: Locator = this.root.locator('.reading-chunk-chip');
  readonly selectedChunksCount: Locator = this.root.locator('#selected-chunks-count');
  readonly btnPrepareLesson: Locator = this.root.locator('#btn-prepare-lesson');
  readonly btnContinue: Locator = this.btnPrepareLesson;
  readonly btnCancelEditSelection: Locator = this.root.locator('#btn-cancel-edit-selection');

  // Ilya Frank Dual-Pass Reading Mode
  readonly frankContainer: Locator = this.root.locator('#ilya-frank-reading-container');
  readonly frankExcerpts: Locator = this.root.locator('.frank-excerpt-card');
  readonly frankGlosses: Locator = this.root.locator('.if-gloss');
  readonly btnFrankToQuiz: Locator = this.root.locator('#btn-frank-to-quiz');
  readonly btnFrankToCards: Locator = this.root.locator('#btn-frank-to-cards');
  readonly btnReselectChunks: Locator = this.root.locator('#btn-reselect-chunks');

  // Quiz Mode
  readonly quizContainer: Locator = this.root.locator('#quiz-study-container');
  readonly quizQuestionCard: Locator = this.root.locator('.quiz-question-card');
  readonly quizQuestionText: Locator = this.root.locator('.quiz-question-text');
  readonly quizOptions: Locator = this.root.locator('.quiz-option-btn');
  readonly quizFeedback: Locator = this.root.locator('.quiz-feedback-box');
  readonly btnNextQuizQuestion: Locator = this.root.locator('#btn-next-quiz-question');
  readonly quizCompletedState: Locator = this.root.locator('#quiz-completed-state');
  readonly btnRestartQuiz: Locator = this.root.locator('#btn-restart-quiz');
  readonly btnQuizToCards: Locator = this.root.locator('#btn-quiz-to-cards');
  readonly btnFinishQuizBack: Locator = this.root.locator('#btn-finish-quiz-back');

  // Flashcards Mode
  readonly flashcard: Locator = this.root.locator('#lesson-flashcard');
  readonly btnPrevCard: Locator = this.root.locator('#btn-lesson-prev');
  readonly btnAudioCard: Locator = this.root.locator('#btn-lesson-audio');
  readonly btnNextCard: Locator = this.root.locator('#btn-lesson-next');
  readonly cardCounter: Locator = this.root.locator('.lesson-detail-counter');
  readonly cardCompletedState: Locator = this.root.locator('#lesson-completed-state');
  readonly cardCompletedTitle: Locator = this.cardCompletedState.locator('.empty-title');
  readonly btnRestartLesson: Locator = this.root.locator('#btn-restart-lesson');
  readonly btnLessonToQuiz: Locator = this.root.locator('#btn-lesson-to-quiz');
  readonly btnCardsToReading: Locator = this.root.locator('#btn-cards-to-reading');
  readonly btnFinishLesson: Locator = this.root.locator('#btn-finish-lesson');

  // List Mode
  readonly listItems: Locator = this.root.locator('.lesson-list-item');

  async close(): Promise<void> {
    await this.btnClose.click();
    await this.expectHidden();
  }

  async switchMode(mode: LessonStudyMode): Promise<void> {
    switch (mode) {
      case 'reading':
        await this.btnModeReading.click();
        await expect(this.readingContainer.or(this.frankContainer)).toBeVisible();
        break;
      case 'quiz':
        await this.btnModeQuiz.click();
        await expect(this.quizContainer).toBeVisible();
        break;
      case 'cards':
        await this.btnModeCards.click();
        await expect(this.flashcard.or(this.cardCompletedState)).toBeVisible();
        break;
      case 'list':
        await this.btnModeList.click();
        await expect(this.root.locator('.lesson-list-mode')).toBeVisible();
        break;
    }
  }

  async startQuizFromFrank(): Promise<void> {
    await this.btnFrankToQuiz.click();
    await expect(this.quizContainer).toBeVisible();
  }

  // Reading Mode Operations
  async selectChunk(index: number): Promise<void> {
    await this.readingChunks.nth(index).click();
  }

  async prepareLesson(): Promise<void> {
    await this.btnPrepareLesson.click();
  }

  async continueReview(): Promise<void> {
    await this.btnContinue.click();
  }

  // Quiz Mode Operations
  getQuizOption(index: number): Locator {
    return this.root.locator(`#quiz-option-${index}`);
  }

  async selectQuizOption(index: number): Promise<void> {
    await this.getQuizOption(index).click();
  }

  async nextQuizQuestion(): Promise<void> {
    await this.btnNextQuizQuestion.click();
  }

  async restartQuiz(): Promise<void> {
    await this.btnRestartQuiz.click();
    await expect(this.quizQuestionCard).toBeVisible();
  }

  // Flashcards Mode Operations
  async flipCard(): Promise<void> {
    await this.flashcard.click();
    // Wait for the 500ms CSS transform transition to finish
    await this.page.waitForTimeout(550);
  }

  async nextCard(): Promise<void> {
    await this.btnNextCard.click();
  }

  async prevCard(): Promise<void> {
    await this.btnPrevCard.click();
  }

  async restartFlashcards(): Promise<void> {
    await this.btnRestartLesson.click();
    await expect(this.flashcard).toBeVisible();
  }
}
