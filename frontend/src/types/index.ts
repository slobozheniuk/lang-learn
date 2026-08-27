// API Types matching FastAPI backend schemas

export interface User {
  id: number;
  email: string;
  username: string;
  default_source_lang: string;
  default_target_lang: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  token: Token;
}

export interface LoginPayload {
  username_or_email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  default_source_lang?: string;
  default_target_lang?: string;
}

export interface Language {
  code: string;
  name: string;
  created_at: string;
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
  language_code: string;
  text: string;
  lemma?: string | null;
  pos?: string | null;
  phonetic?: string | null;
  translation?: string | null;
  context_phrase?: string | null;
  audio_url?: string | null;
  created_at: string;
  updated_at: string;
  user_stats?: UserWordStats | null;
}

export interface WordCreatePayload {
  language_code: string;
  text: string;
  lemma?: string | null;
  pos?: string | null;
  phonetic?: string | null;
  translation?: string | null;
  context_phrase?: string | null;
  audio_url?: string | null;
}

export interface DueWordItem {
  word: Word;
  stats?: UserWordStats | null;
  is_new?: boolean;
}

export type SRSRating = 'again' | 'hard' | 'good' | 'easy' | 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewSubmission {
  word_id: number;
  rating: SRSRating;
}

export interface ReviewResultResponse {
  word_id: number;
  score: number;
  stats: UserWordStats;
  next_review_at: string;
}

export interface Lesson {
  id: number;
  user_id?: number;
  source_lang: string;
  target_lang: string;
  title: string;
  raw_input: string;
  input_type: 'text' | 'youtube' | 'manual' | string;
  status: 'ready' | 'processing' | 'pending' | 'failed' | string;
  created_at: string;
  updated_at: string;
}

export interface LessonCreatePayload {
  source_lang: string;
  target_lang: string;
  title: string;
  raw_input: string;
  input_type?: string;
}

export interface LanguagePair {
  source: string;
  target: string;
  label: string;
}
