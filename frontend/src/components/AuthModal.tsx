import React from 'react';
import { Language } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  authTab: 'login' | 'register';
  authError: string | null;
  languages: Language[];
  loginIdentifier: string;
  loginPassword: string;
  regUsername: string;
  regEmail: string;
  regPassword: string;
  regTargetLang: string;
  onClose: () => void;
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

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  authTab,
  authError,
  languages,
  loginIdentifier,
  loginPassword,
  regUsername,
  regEmail,
  regPassword,
  regTargetLang,
  onClose,
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
    <div
      id="auth-modal"
      className={'modal-backdrop' + (isOpen ? ' is-open open active show' : '')}
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">
            Account
          </h3>
          <button
            id="modal-close-btn"
            className="modal-close"
            aria-label="Close modal"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="modal-tabs">
          <button
            id="tab-login"
            className={'modal-tab' + (authTab === 'login' ? ' active' : '')}
            onClick={() => onTabChange('login')}
          >
            Sign In
          </button>
          <button
            id="tab-register"
            className={'modal-tab' + (authTab === 'register' ? ' active' : '')}
            onClick={() => onTabChange('register')}
          >
            Register
          </button>
        </div>
        <div className="modal-body">
          <div id="auth-alert" className={'modal-alert' + (authError ? ' show' : '')}>
            {authError || ''}
          </div>

          {/* Login Form */}
          <form
            id="login-form"
            className="word-form"
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
            <button type="submit" className="btn btn-primary btn-full">
              Sign In
            </button>
          </form>

          {/* Register Form */}
          <form
            id="register-form"
            className="word-form"
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
            <button type="submit" className="btn btn-primary btn-full">
              Create Account
            </button>
          </form>

          {/* Quick Demo Button */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.85rem',
              textAlign: 'center',
            }}
          >
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
