import apiClient from './client';
import { AuthResponse, LoginPayload, RegisterPayload, Token, User } from '../types';

export const authApi = {
  login: async (payload: LoginPayload): Promise<Token> => {
    const response = await apiClient.post<Token>('/auth/login', payload);
    return response.data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};
