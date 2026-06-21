export type ForeignLanguage = "en" | "ja" | "zh";

export type Direction = "en-ko" | "ko-en" | "ja-ko" | "ko-ja" | "zh-ko" | "ko-zh";

export type Category = "news" | "business" | "conference" | "daily";

export type AudioSource =
  | { type: "tts" }
  | { type: "file"; uri: string };

export interface SentenceEntry {
  id: string;
  category: Category;
  difficulty: 1 | 2 | 3;
  foreignLanguage: ForeignLanguage;
  englishText: string;
  koreanText?: string;
  englishAudio?: AudioSource;
  koreanAudio?: AudioSource;
  japaneseText?: string;
  japaneseAudio?: AudioSource;
  chineseText?: string;
  chineseAudio?: AudioSource;
  modelKorean?: string;
  modelEnglish?: string;
  modelJapanese?: string;
  modelChinese?: string;
  tags: string[];
  durationSeconds?: number;
  notes?: string;
}

export interface SentenceProgress {
  sentenceId: string;
  direction: Direction;
  nextReviewDate: number;
  intervalDays: number;
  reviewCount: number;
  lastStudiedAt: number;
}

export interface SessionResult {
  id: string;
  sentenceId: string;
  direction: Direction;
  timestamp: number;
  interpRecordingUri?: string;
  backInterpRecordingUri?: string;
  backInterpText: string;
  originalText: string;
  notes?: string;
}

export interface UserSettings {
  showSourceTextDuringListen: boolean;
  playbackSpeed: number;
  shuffleSentences: boolean;
  dailyNewLimit: number;
  foreignLanguage: ForeignLanguage;
}

export const DEFAULT_SETTINGS: UserSettings = {
  showSourceTextDuringListen: false,
  playbackSpeed: 1.0,
  shuffleSentences: true,
  dailyNewLimit: 10,
  foreignLanguage: "en",
};

export type SessionStep =
  | "LISTEN_RECORD"
  | "PLAYBACK_BACK"
  | "COMPARE";

export const SESSION_STEPS: SessionStep[] = [
  "LISTEN_RECORD",
  "PLAYBACK_BACK",
  "COMPARE",
];

export const DIFFICULTY_OPTIONS = [
  { difficulty: 3 as const, label: "★★★ 어려움", sublabel: "재도전" },
  { difficulty: 2 as const, label: "★★☆ 보통",   sublabel: "내일" },
  { difficulty: 1 as const, label: "★☆☆ 쉬움",   sublabel: "3일 후" },
];
