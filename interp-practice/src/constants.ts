import type { Category, Direction, ForeignLanguage } from "./types/index";

export const CATEGORY_LABELS: Record<Category, string> = {
  news: "뉴스",
  business: "비즈니스",
  conference: "컨퍼런스",
  daily: "일상",
};

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "news", label: "뉴스" },
  { key: "business", label: "비즈니스" },
  { key: "conference", label: "컨퍼런스" },
  { key: "daily", label: "일상" },
];

export const LANG_LABEL: Record<string, string> = {
  en: "영어",
  ko: "한국어",
  ja: "일본어",
  zh: "중국어",
};

export const FOREIGN_LANGUAGE_LABELS: Record<ForeignLanguage, string> = {
  en: "영어",
  ja: "일본어",
  zh: "중국어",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  "en-ko": "영→한",
  "ko-en": "한→영",
  "ja-ko": "일→한",
  "ko-ja": "한→일",
  "zh-ko": "중→한",
  "ko-zh": "한→중",
};

export const FOREIGN_LANGUAGE_DIRECTIONS: Record<ForeignLanguage, [Direction, Direction]> = {
  en: ["en-ko", "ko-en"],
  ja: ["ja-ko", "ko-ja"],
  zh: ["zh-ko", "ko-zh"],
};
