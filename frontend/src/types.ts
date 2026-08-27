export interface User {
  id: number;
  username: string;
  email: string;
  default_source_lang?: string;
  default_target_lang?: string;
  is_active?: boolean;
}

export interface Language {
  id: number;
  code: string;
  name: string;
  flag_emoji?: string;
}

export interface UserWordStats {
  id: number;
  user_id: number;
  word_id: number;
  repetition_number: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  recall_count: number;
  fail_count: number;
}

export interface Word {
  id: number;
  text: string;
  lemma?: string | null;
  translation: string;
  phonetic?: string | null;
  pos?: string | null;
  context_phrase?: string | null;
  language_code: string;
  audio_url?: string | null;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  user_stats?: UserWordStats | null;
}

export interface FlashcardItem {
  id: number;
  text: string;
  lemma?: string | null;
  translation: string;
  phonetic?: string | null;
  pos?: string | null;
  context_phrase?: string | null;
  language_code?: string;
  audio_url?: string | null;
  stats?: UserWordStats | Record<string, unknown> | null;
  is_new?: boolean;
  user_stats?: UserWordStats | Record<string, unknown> | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  user: User;
  token: AuthResponse;
}

export interface DueReviewItem {
  word: Word;
  stats?: UserWordStats | null;
  is_new?: boolean;
}

export type PageView = 'flashcards' | 'wordlist';
