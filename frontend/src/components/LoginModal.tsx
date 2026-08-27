import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';
import { X, LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    loginModalMode,
    closeLoginModal,
    setLoginModalMode,
    login,
    register,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const { languages } = useLangStore();

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSourceLang, setRegSourceLang] = useState('ru');
  const [regTargetLang, setRegTargetLang] = useState('nl');

  if (!isLoginModalOpen) return null;

  const handleTabChange = (mode: 'login' | 'register') => {
    clearError();
    setLoginModalMode(mode);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) return;
    try {
      await login({
        username_or_email: loginIdentifier.trim(),
        password: loginPassword,
      });
      setLoginIdentifier('');
      setLoginPassword('');
    } catch {
      // Handled by store error state
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword) return;
    try {
      await register({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        default_source_lang: regSourceLang,
        default_target_lang: regTargetLang,
      });
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
    } catch {
      // Handled by store error state
    }
  };

  return (
    <div className="modal-overlay" onClick={closeLoginModal} data-testid="login-modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        data-testid="login-modal"
      >
        {/* Header with Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          {/* Tab Selector */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-secondary)',
              padding: '3px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              data-testid="tab-login-btn"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--radius-full)',
                backgroundColor: loginModalMode === 'login' ? 'var(--bg-card)' : 'transparent',
                color: loginModalMode === 'login' ? 'var(--color-primary)' : 'var(--text-secondary)',
                boxShadow: loginModalMode === 'login' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              data-testid="tab-register-btn"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--radius-full)',
                backgroundColor: loginModalMode === 'register' ? 'var(--bg-card)' : 'transparent',
                color: loginModalMode === 'register' ? 'var(--color-primary)' : 'var(--text-secondary)',
                boxShadow: loginModalMode === 'register' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Register
            </button>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={closeLoginModal}
            style={{ width: '32px', height: '32px' }}
            aria-label="Close"
            data-testid="login-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--srs-again-bg)',
              color: 'var(--srs-again)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              marginBottom: '14px',
            }}
            data-testid="auth-error-message"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {loginModalMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Username or Email
              </label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Username or email address"
                required
                data-testid="login-username-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                required
                data-testid="login-password-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !loginIdentifier || !loginPassword}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px', gap: '6px' }}
              data-testid="login-submit-btn"
            >
              {isLoading ? (
                <Loader2 size={16} style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Username
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g. polyglot123"
                minLength={3}
                required
                data-testid="register-username-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                required
                data-testid="register-email-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Password (min 6 characters)
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Choose a secure password"
                minLength={6}
                required
                data-testid="register-password-input"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  Native Lang
                </label>
                <select
                  value={regSourceLang}
                  onChange={(e) => setRegSourceLang(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  Learning Lang
                </label>
                <select
                  value={regTargetLang}
                  onChange={(e) => setRegTargetLang(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !regUsername || !regEmail || !regPassword}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px', gap: '6px' }}
              data-testid="register-submit-btn"
            >
              {isLoading ? (
                <Loader2 size={16} style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
