import type { Direction, ForeignLanguage, SessionStep } from "./types";

export const SESSION_STEPS: SessionStep[] = ["LISTEN_RECORD", "PLAYBACK_BACK", "COMPARE"];

export const STEP_LABELS: Record<SessionStep, string> = {
  LISTEN_RECORD: "듣기/통역",
  PLAYBACK_BACK: "확인/역통역",
  COMPARE: "비교",
};

export function getNextStep(current: SessionStep): SessionStep | null {
  const index = SESSION_STEPS.indexOf(current);
  return index >= 0 && index < SESSION_STEPS.length - 1 ? SESSION_STEPS[index + 1] : null;
}

export function getSTTLocale(direction: Direction): string {
  return direction === "en-ko"
    ? "en-US"
    : direction === "ja-ko"
      ? "ja-JP"
      : direction === "zh-ko"
        ? "zh-CN"
        : "ko-KR";
}

export function directionForeignLanguage(direction: Direction): ForeignLanguage {
  if (direction.includes("ja")) return "ja";
  if (direction.includes("zh")) return "zh";
  return "en";
}

export function nextReviewDate(now: number, intervalDays: number): number {
  return now + intervalDays * 24 * 60 * 60 * 1000;
}

export function stableId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return `auto_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}
