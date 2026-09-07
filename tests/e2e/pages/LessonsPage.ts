import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BurgerMenuDrawer } from './components/BurgerMenuDrawer';
import { BottomDockComponent } from './components/BottomDockComponent';

export class LessonsPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#lessons-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly drawer = new BurgerMenuDrawer(this.page);
  readonly dock = new BottomDockComponent(this.page);

  // View elements
  readonly emptyState: Locator = this.root.locator('#lessons-empty');
  readonly grid: Locator = this.root.locator('#lessons-grid');
  readonly lessonCards: Locator = this.root.locator('.lesson-card');

  async expectEmpty(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.lessonCards).toHaveCount(0);
  }

  async getLessonCount(): Promise<number> {
    return await this.lessonCards.count();
  }

  getLessonCard(indexOrNumber: number): Locator {
    return this.page.locator(`#lesson-card-${indexOrNumber}`).or(this.lessonCards.nth(indexOrNumber));
  }

  async openLesson(indexOrNumber: number): Promise<void> {
    const card = this.getLessonCard(indexOrNumber);
    await card.click();
  }

  async openLessonMenu(indexOrNumber: number): Promise<void> {
    const card = this.getLessonCard(indexOrNumber);
    const dotsBtn = card.locator('.btn-lesson-dots-menu');
    await dotsBtn.click();
    await expect(card.locator('.lesson-dropdown-menu')).toBeVisible();
  }

  async deleteLesson(indexOrNumber: number): Promise<void> {
    const card = this.getLessonCard(indexOrNumber);
    await this.openLessonMenu(indexOrNumber);
    const deleteBtn = card.locator('.dropdown-item-delete');
    await deleteBtn.click();
  }

  async expectLessonTitle(indexOrNumber: number, title: string): Promise<void> {
    const card = this.getLessonCard(indexOrNumber);
    await expect(card.locator('.lesson-title')).toContainText(title);
  }
}
