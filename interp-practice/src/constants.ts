import type { Category } from "./types/index";

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
