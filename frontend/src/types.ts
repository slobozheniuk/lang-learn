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

export interface Word {
  id: number;
  text: string;
  translation: string;
  phonetic?: string | null;
  pos?: string | null;
  context_phrase?: string | null;
  language_code: string;
  user_id?: number;
}

export interface FlashcardItem {
  id: number;
  text: string;
  translation: string;
  phonetic?: string | null;
  pos?: string | null;
  context_phrase?: string | null;
  language_code?: string;
  stats?: Record<string, unknown> | null;
  is_new?: boolean;
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
  stats?: Record<string, unknown> | null;
  is_new?: boolean;
}
