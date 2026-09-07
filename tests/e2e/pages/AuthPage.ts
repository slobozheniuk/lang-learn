import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class AuthPage extends BasePage {
  readonly url = '/';
  readonly root: Locator = this.page.locator('#auth-view');

  // Form toggles
  readonly tabLogin: Locator = this.root.locator('#tab-login');
  readonly tabRegister: Locator = this.root.locator('#tab-register');
  readonly authTitle: Locator = this.root.locator('#auth-title');
  readonly authAlert: Locator = this.root.locator('#auth-alert');

  // Login Form
  readonly formLogin: Locator = this.root.locator('#login-form');
  readonly inputLoginIdentifier: Locator = this.root.locator('#login-identifier');
  readonly inputLoginPassword: Locator = this.root.locator('#login-password');
  readonly btnLoginSubmit: Locator = this.root.locator('#btn-login-submit');

  // Register Form
  readonly formRegister: Locator = this.root.locator('#register-form');
  readonly inputRegUsername: Locator = this.root.locator('#reg-username');
  readonly inputRegPassword: Locator = this.root.locator('#reg-password');
  readonly selectRegNativeLang: Locator = this.root.locator('#reg-native-lang');
  readonly selectRegTargetLang: Locator = this.root.locator('#reg-target-lang');
  readonly btnRegisterSubmit: Locator = this.root.locator('#btn-register-submit');

  async switchTab(tab: 'login' | 'register'): Promise<void> {
    if (tab === 'login') {
      await this.tabLogin.click();
      await expect(this.formLogin).toBeVisible();
    } else {
      await this.tabRegister.click();
      await expect(this.formRegister).toBeVisible();
    }
  }

  async login(usernameOrEmail: string, password: string): Promise<void> {
    if (!(await this.formLogin.isVisible())) {
      await this.switchTab('login');
    }
    await this.inputLoginIdentifier.fill(usernameOrEmail);
    await this.inputLoginPassword.fill(password);
    await this.btnLoginSubmit.click();
  }

  async register(
    username: string,
    password: string,
    nativeLang = 'en',
    targetLang = 'nl'
  ): Promise<void> {
    if (!(await this.formRegister.isVisible())) {
      await this.switchTab('register');
    }
    await this.inputRegUsername.fill(username);
    await this.inputRegPassword.fill(password);
    if (nativeLang) {
      await this.selectRegNativeLang.selectOption(nativeLang);
    }
    if (targetLang) {
      await this.selectRegTargetLang.selectOption(targetLang);
    }
    await this.btnRegisterSubmit.click();
  }

  async expectErrorMessage(text: string): Promise<void> {
    await expect(this.authAlert).toBeVisible();
    await expect(this.authAlert).toContainText(text);
  }
}
