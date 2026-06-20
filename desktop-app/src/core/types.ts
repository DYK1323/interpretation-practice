export type ForeignLanguage = "en" | "ja" | "zh";
export type Direction = "en-ko" | "ko-en" | "ja-ko" | "ko-ja" | "zh-ko" | "ko-zh";
export type Category = "news" | "business" | "conference" | "daily";
export type SessionStep = "LISTEN_RECORD" | "PLAYBACK_BACK" | "COMPARE";

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
  lastStudiedAt: number | null;
  firstStudiedAt?: number | null;
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
  playbackSpeed: 1,
  shuffleSentences: true,
  dailyNewLimit: 10,
  foreignLanguage: "en",
};

export const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "news", label: "뉴스" },
  { key: "business", label: "비즈니스" },
  { key: "conference", label: "컨퍼런스" },
  { key: "daily", label: "일상" },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  news: "뉴스",
  business: "비즈니스",
  conference: "컨퍼런스",
  daily: "일상",
};

export const FOREIGN_LANGUAGE_LABELS: Record<ForeignLanguage, string> = {
  en: "영어",
  ja: "일본어",
  zh: "중국어",
};

export const LANG_LABEL: Record<string, string> = {
  en: "영어",
  ko: "한국어",
  ja: "일본어",
  zh: "중국어",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  "en-ko": "영한",
  "ko-en": "한영",
  "ja-ko": "일한",
  "ko-ja": "한일",
  "zh-ko": "중한",
  "ko-zh": "한중",
};

export const FOREIGN_LANGUAGE_DIRECTIONS: Record<ForeignLanguage, [Direction, Direction]> = {
  en: ["en-ko", "ko-en"],
  ja: ["ja-ko", "ko-ja"],
  zh: ["zh-ko", "ko-zh"],
};

export const DIFFICULTY_OPTIONS = [
  { difficulty: 3 as const, label: "어려움", days: 1, sublabel: "내일 복습" },
  { difficulty: 2 as const, label: "보통", days: 3, sublabel: "3일 뒤" },
  { difficulty: 1 as const, label: "쉬움", days: 7, sublabel: "1주 뒤" },
];

export function sourceTextOf(sentence: SentenceEntry): string {
  if (sentence.foreignLanguage === "ja") return sentence.japaneseText ?? "";
  if (sentence.foreignLanguage === "zh") return sentence.chineseText ?? "";
  return sentence.englishText;
}

export function sourceLangCode(direction: Direction): string {
  if (direction === "en-ko") return "en-US";
  if (direction === "ja-ko") return "ja-JP";
  if (direction === "zh-ko") return "zh-CN";
  return "ko-KR";
}

export function modelInterpretation(sentence: SentenceEntry, direction: Direction): string | undefined {
  switch (direction) {
    case "en-ko":
    case "ja-ko":
    case "zh-ko":
      return sentence.modelKorean ?? sentence.koreanText;
    case "ko-en":
      return sentence.modelEnglish ?? sentence.englishText;
    case "ko-ja":
      return sentence.modelJapanese ?? sentence.japaneseText;
    case "ko-zh":
      return sentence.modelChinese ?? sentence.chineseText;
  }
}
