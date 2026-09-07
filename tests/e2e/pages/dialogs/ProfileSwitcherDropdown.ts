import { Page, Locator, expect } from '@playwright/test';
import { BaseComponent } from '../BaseComponent';

export class ProfileSwitcherDropdown extends BaseComponent {
  readonly toggleBtn: Locator = this.root.locator('#profile-switcher-btn');
  readonly dropdown: Locator = this.root.locator('.profile-dropdown');
  readonly profileItems: Locator = this.root.locator('.profile-dropdown-item');
  readonly btnAddProfile: Locator = this.root.locator('#profile-add-btn');
  readonly addForm: Locator = this.root.locator('.profile-add-form');
  readonly selectSourceLang: Locator = this.addForm.locator('select').nth(0);
  readonly selectTargetLang: Locator = this.addForm.locator('select').nth(1);
  readonly btnSubmitAdd: Locator = this.addForm.locator('button[type="submit"]');
  readonly btnCancelAdd: Locator = this.addForm.locator('button.btn-outline');

  constructor(page: Page) {
    super(page, page.locator('.profile-switcher'));
  }

  async toggle(): Promise<void> {
    await this.toggleBtn.click();
  }

  async expectOpen(): Promise<void> {
    await expect(this.dropdown).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dropdown).toHaveCount(0);
  }

  async selectProfile(languagePair: string): Promise<void> {
    if (!(await this.dropdown.isVisible())) {
      await this.toggle();
    }
    await this.profileItems.filter({ hasText: languagePair }).click();
    await this.expectClosed();
  }

  async openAddProfileForm(): Promise<void> {
    if (!(await this.dropdown.isVisible())) {
      await this.toggle();
    }
    await this.btnAddProfile.click();
    await expect(this.addForm).toBeVisible();
  }

  async addProfile(sourceLang: string, targetLang: string): Promise<void> {
    await this.openAddProfileForm();
    await this.selectSourceLang.selectOption(sourceLang);
    await this.selectTargetLang.selectOption(targetLang);
    await this.btnSubmitAdd.click();
    await this.expectClosed();
  }

  async cancelAddProfile(): Promise<void> {
    await this.btnCancelAdd.click();
    await expect(this.addForm).toHaveCount(0);
  }
}
