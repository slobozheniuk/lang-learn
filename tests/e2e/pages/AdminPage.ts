import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BurgerMenuDrawer } from './components/BurgerMenuDrawer';

export class AdminPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#admin-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly drawer = new BurgerMenuDrawer(this.page);

  // Tabs
  readonly tabUsers: Locator = this.root.locator('#admin-tab-users');
  readonly tabLogs: Locator = this.root.locator('#admin-tab-logs');

  // Users Panel
  readonly usersPanel: Locator = this.root.locator('#admin-users-panel');
  readonly statTotalUsers: Locator = this.root.locator('#stat-total-users .metric-value');
  readonly statTotalLessons: Locator = this.root.locator('#stat-total-lessons .metric-value');
  readonly statTotalWords: Locator = this.root.locator('#stat-total-words .metric-value');
  readonly usersList: Locator = this.root.locator('#admin-users-list');
  readonly userCards: Locator = this.root.locator('.admin-user-card');

  // Logs Panel
  readonly logsPanel: Locator = this.root.locator('#admin-logs-panel');
  readonly filterJourneyType: Locator = this.root.locator('#filter-journey-type');
  readonly btnRefreshLogs: Locator = this.root.locator('#btn-refresh-logs');
  readonly journeysList: Locator = this.root.locator('#admin-journeys-list');
  readonly journeyButtons: Locator = this.root.locator('.admin-journey-item-btn');

  // Separate Journey Detail View
  readonly journeyDetailView: Locator = this.root.locator('#admin-journey-detail-view');
  readonly btnBackToJourneys: Locator = this.root.locator('#btn-back-to-journeys');
  readonly journeyDetailTypeBadge: Locator = this.root.locator('.journey-detail-header .journey-type-badge');
  readonly journeyDetailStatusBadge: Locator = this.root.locator('.detail-top-bar .journey-status-badge');
  readonly journeyDetailUser: Locator = this.root.locator('.journey-meta-row .journey-user');
  readonly journeyDetailChosenChunksSection: Locator = this.root.locator('.journey-chosen-chunks');
  readonly chosenChunkChips: Locator = this.root.locator('.chosen-chunk-chip');
  readonly actionSteps: Locator = this.root.locator('.journey-action-step');
  readonly actionStepNames: Locator = this.root.locator('.step-name');
  readonly llmCards: Locator = this.root.locator('.llm-interaction-card');
  readonly llmPrompts: Locator = this.root.locator('.llm-input-prompt');
  readonly llmOutputs: Locator = this.root.locator('.llm-output-text');

  constructor(page: Page) {
    super(page);
  }

  async switchToUsersTab(): Promise<void> {
    await this.tabUsers.click();
    await expect(this.usersPanel).toBeVisible();
  }

  async switchToLogsTab(): Promise<void> {
    await this.tabLogs.click();
    await expect(this.logsPanel).toBeVisible();
  }

  async filterJourneys(type: 'all' | 'word_adding' | 'lesson_creation'): Promise<void> {
    await this.filterJourneyType.selectOption(type);
  }

  async refreshLogs(): Promise<void> {
    await this.btnRefreshLogs.click();
  }

  /**
   * Clicks on a journey button by its ID or index to open the separate Journey Detail page.
   */
  async openJourney(journeyIdOrIndex: string | number): Promise<void> {
    if (typeof journeyIdOrIndex === 'string') {
      const btn = this.root.locator(`#journey-${journeyIdOrIndex}`);
      await btn.click();
    } else {
      await this.journeyButtons.nth(journeyIdOrIndex).click();
    }
    await expect(this.journeyDetailView).toBeVisible();
  }

  /**
   * Clicks the Back button inside the Journey Detail page to return to the journeys list.
   */
  async backToJourneys(): Promise<void> {
    await this.btnBackToJourneys.click();
    await expect(this.journeyDetailView).toBeHidden();
    await expect(this.journeysList).toBeVisible();
  }

  async getChosenChunks(): Promise<string[]> {
    return this.chosenChunkChips.allInnerTexts();
  }

  async getActionStepNames(): Promise<string[]> {
    return this.actionStepNames.allInnerTexts();
  }

  async getFirstLLMInteraction(): Promise<{ prompt: string; output: string }> {
    const prompt = await this.llmPrompts.first().innerText();
    const output = await this.llmOutputs.first().innerText();
    return { prompt, output };
  }
}
