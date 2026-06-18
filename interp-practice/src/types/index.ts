export type Direction = "en-ko" | "ko-en";

export type Category = "news" | "business" | "conference" | "daily";

export type AudioSource =
  | { type: "tts" }
  | { type: "file"; uri: string };

export interface SentenceEntry {
  id: string;
  category: Category;
  difficulty: 1 | 2 | 3;
  englishText: string;
  koreanText?: string;
  englishAudio?: AudioSource;
  koreanAudio?: AudioSource;
  modelKorean?: string;
  modelEnglish?: string;
  tags: string[];
  durationSeconds?: number;
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
  backInterpText: string;
  originalText: string;
  notes?: string;
}

export interface UserSettings {
  showSourceTextDuringListen: boolean;
  playbackSpeed: 0.75 | 1.0 | 1.25;
}

export const DEFAULT_SETTINGS: UserSettings = {
  showSourceTextDuringListen: false,
  playbackSpeed: 1.0,
};

export type SessionStep =
  | "LISTEN_SOURCE"
  | "RECORD_INTERP"
  | "PLAYBACK_INTERP"
  | "RECORD_BACK"
  | "COMPARE";

export const SESSION_STEPS: SessionStep[] = [
  "LISTEN_SOURCE",
  "RECORD_INTERP",
  "PLAYBACK_INTERP",
  "RECORD_BACK",
  "COMPARE",
];

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;
export type ReviewInterval = (typeof REVIEW_INTERVALS)[number];
