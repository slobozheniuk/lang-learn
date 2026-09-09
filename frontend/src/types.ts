export interface User {
  id: number;
  username: string;
  is_active?: boolean;
  is_admin?: boolean;
  profiles?: LearningProfile[];
}

export interface LearningProfile {
  id: number;
  user_id: number;
  source_language: string;
  target_language: string;
  is_active: boolean;
  is_current?: boolean;
  created_at: string;
  updated_at?: string | null;
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

export type PageView = 'lessons' | 'flashcards' | 'wordlist' | 'settings' | 'admin';

export interface AdminUserStats {
  id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  lesson_count: number;
  word_count: number;
}

export interface JourneyAction {
  name: string;
  timestamp: string;
  stage: string;
  details?: Record<string, any>;
}

export interface JourneyLLMInteraction {
  step: string;
  prompt: string;
  output: string;
  timestamp: string;
}

export interface JourneyLog {
  journey_id: string;
  journey_type: 'word_adding' | 'lesson_creation' | string;
  user_id?: number | null;
  username?: string | null;
  timestamp: string;
  status: string;
  input_text?: string;
  chosen_chunks: string[];
  actions: JourneyAction[];
  llm_interactions: JourneyLLMInteraction[];
}

export interface QuizQuestion {
  id?: number;
  question: string;
  options: string[];
  correct_index?: number;
  correct_option_index?: number;
  correct_answer?: string;
  explanation?: string | null;
  target_word?: string | null;
}

export interface QuizData {
  title?: string;
  questions: QuizQuestion[];
}

export interface ChunkItem {
  id?: number | string;
  text: string;
  is_selectable?: boolean;
  is_word?: boolean;
  lemma?: string | null;
  pos?: string | null;
  translation?: string | null;
}

export interface ChunkResponse {
  title?: string | null;
  chunks: ChunkItem[];
  raw_text?: string | null;
  lesson_id?: number | null;
}

export interface IlyaFrankExcerpt {
  index: number;
  adapted_text: string;
  raw_text: string;
  vocabulary_extracted?: Word[];
}

export interface IlyaFrankData {
  excerpts: IlyaFrankExcerpt[];
}

export interface Lesson {
  id: number;
  number?: number;
  title: string;
  words: Word[];
  totalWords?: number;
  targetCount?: number;
  isComplete?: boolean;
  is_completed?: boolean;
  input_type?: string;
  quiz_data?: QuizData | any;
  chunk_data?: ChunkResponse | ChunkItem[] | any;
  ilya_frank_data?: IlyaFrankData | any;
  status?: string;
  raw_input?: string;
  source_lang?: string;
  target_lang?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Job {
  id: string;
  user_id: number;
  type: string;
  status: string;
  input_text: string;
  source_lang: string;
  target_lang: string;
  lesson_id?: number | null;
  result_json?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TextSubmissionResponse {
  job_id: string;
  status: string;
  is_lesson: boolean;
  is_multi_sentence?: boolean;
  sentence_count?: number;
  word_count?: number;
  can_create_lesson?: boolean;
  lesson_in_progress?: boolean;
  lesson?: Lesson | null;
  words: Word[];
  error_message?: string | null;
}
