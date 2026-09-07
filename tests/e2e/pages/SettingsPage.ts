import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderComponent } from './components/HeaderComponent';
import { BurgerMenuDrawer } from './components/BurgerMenuDrawer';

export class SettingsPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#settings-view');

  // Composed components
  readonly header = new HeaderComponent(this.page);
  readonly drawer = new BurgerMenuDrawer(this.page);

  // Settings elements
  readonly userName: Locator = this.root.locator('.settings-user-name');
  readonly btnLogout: Locator = this.root.locator('#btn-logout');

  async expectUsername(name: string): Promise<void> {
    await expect(this.userName).toHaveText(name);
  }

  async logout(): Promise<void> {
    await this.btnLogout.click();
    await this.expectHidden();
  }
}
