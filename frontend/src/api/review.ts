import apiClient from './client';
import { DueWordItem, ReviewResultResponse, ReviewSubmission } from '../types';

export const reviewApi = {
  getDueReviews: async (targetLang?: string, limit: number = 20): Promise<DueWordItem[]> => {
    const response = await apiClient.get<DueWordItem[]>('/review/due', {
      params: {
        target_lang: targetLang,
        limit,
      },
    });
    return response.data;
  },

  submitReview: async (submission: ReviewSubmission): Promise<ReviewResultResponse> => {
    const response = await apiClient.post<ReviewResultResponse>('/review/submit', submission);
    return response.data;
  },
};
