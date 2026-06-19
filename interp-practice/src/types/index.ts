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
  playbackSpeed: 0.75 | 1.0 | 1.25;
}

export const DEFAULT_SETTINGS: UserSettings = {
  showSourceTextDuringListen: false,
  playbackSpeed: 1.0,
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

// 난이도 = 복습 간격: 어려움(1일) / 보통(3일) / 쉬움(1주)
export const DIFFICULTY_OPTIONS = [
  { difficulty: 3 as const, label: "★★★ 어려움", days: 1, sublabel: "내일 복습" },
  { difficulty: 2 as const, label: "★★☆ 보통",   days: 3, sublabel: "3일 후" },
  { difficulty: 1 as const, label: "★☆☆ 쉬움",   days: 7, sublabel: "1주 후" },
];
