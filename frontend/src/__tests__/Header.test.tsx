import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from '../components/Header';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';

describe('Header Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    useLangStore.setState({
      sourceLang: 'ru',
      targetLang: 'nl',
    });
  });

  it('renders application branding and language pair selector', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    expect(screen.getByText('LinguaFlash')).toBeInTheDocument();
    expect(screen.getByTestId('lang-selector-btn')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('allows switching language pairs through the dropdown', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    const langBtn = screen.getByTestId('lang-selector-btn');
    fireEvent.click(langBtn);

    // Dropdown items should appear
    const enNlOption = screen.getByText('🇬🇧 EN → 🇳🇱 NL');
    expect(enNlOption).toBeInTheDocument();

    fireEvent.click(enNlOption);
    expect(useLangStore.getState().sourceLang).toBe('en');
    expect(useLangStore.getState().targetLang).toBe('nl');
  });

  it('renders user badge and logout button when authenticated', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        default_source_lang: 'ru',
        default_target_lang: 'nl',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      isAuthenticated: true,
      token: 'valid-jwt',
    });

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    );

    expect(screen.getByTestId('user-badge')).toHaveTextContent('alice');
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('logout-btn'));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('calls onOpenWordAdd when add word button is clicked', () => {
    const handleOpenWordAdd = vi.fn();
    render(
      <BrowserRouter>
        <Header onOpenWordAdd={handleOpenWordAdd} />
      </BrowserRouter>
    );

    const addWordBtn = screen.getByTestId('header-add-word-btn');
    fireEvent.click(addWordBtn);
    expect(handleOpenWordAdd).toHaveBeenCalledTimes(1);
  });
});
