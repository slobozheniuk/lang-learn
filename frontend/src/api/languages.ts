import apiClient from './client';
import { Language } from '../types';

export const languagesApi = {
  getLanguages: async (): Promise<Language[]> => {
    const response = await apiClient.get<Language[]>('/languages/');
    return response.data;
  },

  addLanguage: async (payload: { code: string; name: string }): Promise<Language> => {
    const response = await apiClient.post<Language>('/languages/', payload);
    return response.data;
  },
};
