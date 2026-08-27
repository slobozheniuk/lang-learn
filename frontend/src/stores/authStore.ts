import { create } from 'zustand';
import { authApi } from '../api/auth';
import { LoginPayload, RegisterPayload, User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isLoginModalOpen: boolean;
  loginModalMode: 'login' | 'register';

  // Actions
  openLoginModal: (mode?: 'login' | 'register') => void;
  closeLoginModal: () => void;
  setLoginModalMode: (mode: 'login' | 'register') => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for unauthorized events to clear state
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
      set({ user: null, token: null, isAuthenticated: false });
    });
  }

  return {
    user: null,
    token: typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null,
    isAuthenticated: typeof localStorage !== 'undefined' ? !!localStorage.getItem('auth_token') : false,
    isLoading: false,
    error: null,
    isLoginModalOpen: false,
    loginModalMode: 'login',

    openLoginModal: (mode = 'login') => {
      set({ isLoginModalOpen: true, loginModalMode: mode, error: null });
    },

    closeLoginModal: () => {
      set({ isLoginModalOpen: false, error: null });
    },

    setLoginModalMode: (mode) => {
      set({ loginModalMode: mode, error: null });
    },

    login: async (payload: LoginPayload) => {
      set({ isLoading: true, error: null });
      try {
        const tokenRes = await authApi.login(payload);
        localStorage.setItem('auth_token', tokenRes.access_token);
        set({ token: tokenRes.access_token, isAuthenticated: true });

        // Fetch user profile
        const user = await authApi.getMe();
        set({ user, isLoading: false, isLoginModalOpen: false });
      } catch (err: any) {
        const message =
          err.response?.data?.detail ||
          err.message ||
          'Login failed. Please check your credentials.';
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    register: async (payload: RegisterPayload) => {
      set({ isLoading: true, error: null });
      try {
        const authRes = await authApi.register(payload);
        localStorage.setItem('auth_token', authRes.token.access_token);
        set({
          user: authRes.user,
          token: authRes.token.access_token,
          isAuthenticated: true,
          isLoading: false,
          isLoginModalOpen: false,
        });
      } catch (err: any) {
        const message =
          err.response?.data?.detail ||
          err.message ||
          'Registration failed. Please try again.';
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    logout: () => {
      localStorage.removeItem('auth_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    },

    fetchMe: async () => {
      const token = get().token;
      if (!token) return;

      set({ isLoading: true });
      try {
        const user = await authApi.getMe();
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        // If fetch fails, clear token
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    },

    initAuth: async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        set({ token, isAuthenticated: true });
        await get().fetchMe();
      }
    },

    clearError: () => set({ error: null }),
  };
});
