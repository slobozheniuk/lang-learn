import React from 'react';
import { Language } from '../types';

export interface AuthViewProps {
  authTab: 'login' | 'register';
  authError: string | null;
  languages: Language[];
  loginIdentifier: string;
  loginPassword: string;
  regUsername: string;
  regEmail: string;
  regPassword: string;
  regTargetLang: string;
  onTabChange: (tab: 'login' | 'register') => void;
  onLoginIdentifierChange: (val: string) => void;
  onLoginPasswordChange: (val: string) => void;
  onRegUsernameChange: (val: string) => void;
  onRegEmailChange: (val: string) => void;
  onRegPasswordChange: (val: string) => void;
  onRegTargetLangChange: (val: string) => void;
  onLoginSubmit: (e: React.FormEvent) => void;
  onRegisterSubmit: (e: React.FormEvent) => void;
  onQuickDemoLogin: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  authTab,
  authError,
  languages,
  loginIdentifier,
  loginPassword,
  regUsername,
  regEmail,
  regPassword,
  regTargetLang,
  onTabChange,
  onLoginIdentifierChange,
  onLoginPasswordChange,
  onRegUsernameChange,
  onRegEmailChange,
  onRegPasswordChange,
  onRegTargetLangChange,
  onLoginSubmit,
  onRegisterSubmit,
  onQuickDemoLogin,
}) => {
  return (
    <div id="auth-view" className="auth-view-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-badge">⚡</div>
          <h2 id="auth-title" className="auth-title">
            {authTab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="auth-subtitle">
            {authTab === 'login'
              ? 'Sign in to access your spaced repetition flashcards and lessons'
              : 'Start learning languages efficiently with smart SRS cards'}
          </p>
        </div>

        <div className="auth-tabs modal-tabs">
          <button
            type="button"
            id="tab-login"
            className={'auth-tab modal-tab' + (authTab === 'login' ? ' active' : '')}
            onClick={() => onTabChange('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-register"
            className={'auth-tab modal-tab' + (authTab === 'register' ? ' active' : '')}
            onClick={() => onTabChange('register')}
          >
            Register
          </button>
        </div>

        <div className="auth-body modal-body">
          <div id="auth-alert" className={'auth-alert modal-alert' + (authError ? ' show' : '')}>
            {authError || ''}
          </div>

          {/* Login Form */}
          <form
            id="login-form"
            className="word-form auth-form"
            style={{ display: authTab === 'login' ? 'flex' : 'none' }}
            onSubmit={onLoginSubmit}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">
                Username or Email
              </label>
              <input
                type="text"
                id="login-identifier"
                className="input-field"
                placeholder="username or user@example.com"
                required
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => onLoginIdentifierChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <input
                type="password"
                id="login-password"
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => onLoginPasswordChange(e.target.value)}
              />
            </div>
            <button type="submit" id="btn-login-submit" className="btn btn-primary btn-full">
              Sign In
            </button>
          </form>

          {/* Register Form */}
          <form
            id="register-form"
            className="word-form auth-form"
            style={{ display: authTab === 'register' ? 'flex' : 'none' }}
            onSubmit={onRegisterSubmit}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">
                Username
              </label>
              <input
                type="text"
                id="reg-username"
                className="input-field"
                placeholder="student123"
                minLength={3}
                required
                autoComplete="username"
                value={regUsername}
                onChange={(e) => onRegUsernameChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                Email
              </label>
              <input
                type="email"
                id="reg-email"
                className="input-field"
                placeholder="student@example.com"
                required
                autoComplete="email"
                value={regEmail}
                onChange={(e) => onRegEmailChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Password
              </label>
              <input
                type="password"
                id="reg-password"
                className="input-field"
                placeholder="At least 6 characters"
                minLength={6}
                required
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => onRegPasswordChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-target-lang">
                Target Learning Language
              </label>
              <select
                id="reg-target-lang"
                className="lang-select"
                value={regTargetLang}
                onChange={(e) => onRegTargetLangChange(e.target.value)}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name + ' (' + lang.code.toUpperCase() + ')'}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" id="btn-register-submit" className="btn btn-primary btn-full">
              Create Account
            </button>
          </form>

          {/* Quick Demo Button */}
          <div className="auth-demo-divider">
            <button
              type="button"
              id="quick-demo-btn"
              className="btn btn-outline btn-full btn-sm"
              onClick={onQuickDemoLogin}
            >
              ⚡ Quick Demo Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
