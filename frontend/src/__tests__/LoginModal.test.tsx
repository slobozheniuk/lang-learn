import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginModal } from '../components/LoginModal';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';

describe('LoginModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      isLoginModalOpen: true,
      loginModalMode: 'login',
      error: null,
    });
  });

  it('allows logging in with credentials', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      access_token: 'fake-jwt-token',
      token_type: 'bearer',
    });
    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      id: 1,
      username: 'johndoe',
      email: 'john@example.com',
      default_source_lang: 'ru',
      default_target_lang: 'nl',
      is_active: true,
      created_at: '',
      updated_at: '',
    });

    render(<LoginModal />);

    expect(screen.getByTestId('login-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('login-username-input'), {
      target: { value: 'johndoe' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'secretpass' },
    });

    fireEvent.click(screen.getByTestId('login-submit-btn'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        username_or_email: 'johndoe',
        password: 'secretpass',
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoginModalOpen).toBe(false);
    });
  });

  it('allows switching to registration tab and registering a new account', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValue({
      user: {
        id: 2,
        username: 'newlearner',
        email: 'new@example.com',
        default_source_lang: 'ru',
        default_target_lang: 'nl',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      token: {
        access_token: 'new-reg-jwt-token',
        token_type: 'bearer',
      },
    });

    render(<LoginModal />);

    // Switch to register tab
    fireEvent.click(screen.getByTestId('tab-register-btn'));

    expect(screen.getByTestId('register-username-input')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('register-username-input'), {
      target: { value: 'newlearner' },
    });
    fireEvent.change(screen.getByTestId('register-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('register-password-input'), {
      target: { value: 'securepassword123' },
    });

    fireEvent.click(screen.getByTestId('register-submit-btn'));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newlearner',
          email: 'new@example.com',
          password: 'securepassword123',
        })
      );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.username).toBe('newlearner');
    });
  });
});
