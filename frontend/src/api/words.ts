import apiClient from './client';
import { Word, WordCreatePayload } from '../types';

export const wordsApi = {
  createWord: async (payload: WordCreatePayload): Promise<Word> => {
    const response = await apiClient.post<Word>('/words/', payload);
    return response.data;
  },

  getWords: async (params?: {
    language_code?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Word[]> => {
    const response = await apiClient.get<Word[]>('/words/', { params });
    return response.data;
  },

  getWord: async (wordId: number): Promise<Word> => {
    const response = await apiClient.get<Word>(`/words/${wordId}`);
    return response.data;
  },

  deleteWord: async (wordId: number): Promise<void> => {
    await apiClient.delete(`/words/${wordId}`);
  },
};
