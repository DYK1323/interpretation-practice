import type { SessionStep, Direction } from "../../types";

export const STEP_LABELS: Record<SessionStep, string> = {
  LISTEN_SOURCE: "듣기",
  RECORD_INTERP: "통역",
  PLAYBACK_INTERP: "확인",
  RECORD_BACK: "재통역",
  COMPARE: "비교",
};

export const STEP_DESCRIPTIONS: Record<SessionStep, (dir: Direction) => string> = {
  LISTEN_SOURCE: (d) => (d === "en-ko" ? "영어 문장을 들으세요" : "한국어 문장을 들으세요"),
  RECORD_INTERP: (d) => (d === "en-ko" ? "한국어로 통역하세요" : "영어로 통역하세요"),
  PLAYBACK_INTERP: (d) =>
    d === "en-ko" ? "내 한국어 통역을 확인하세요" : "내 영어 통역을 확인하세요",
  RECORD_BACK: (d) => (d === "en-ko" ? "영어로 다시 통역하세요" : "한국어로 다시 통역하세요"),
  COMPARE: () => "원문과 비교하세요",
};

export function getSTTLocale(direction: Direction): string {
  // Step 4 re-interpretation is back into the source language
  return direction === "en-ko" ? "en-US" : "ko-KR";
}

export function getNextStep(current: SessionStep): SessionStep | null {
  const order: SessionStep[] = [
    "LISTEN_SOURCE",
    "RECORD_INTERP",
    "PLAYBACK_INTERP",
    "RECORD_BACK",
    "COMPARE",
  ];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

export function getStepIndex(step: SessionStep): number {
  const order: SessionStep[] = [
    "LISTEN_SOURCE",
    "RECORD_INTERP",
    "PLAYBACK_INTERP",
    "RECORD_BACK",
    "COMPARE",
  ];
  return order.indexOf(step);
}
