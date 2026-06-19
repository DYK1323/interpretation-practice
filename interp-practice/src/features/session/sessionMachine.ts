import type { SessionStep, Direction } from "../../types";

export const STEP_LABELS: Record<SessionStep, string> = {
  LISTEN_RECORD: "듣기/통역",
  PLAYBACK_BACK: "확인/재통역",
  COMPARE: "비교",
};

export const STEP_DESCRIPTIONS: Record<SessionStep, (dir: Direction) => string> = {
  LISTEN_RECORD: (d) =>
    d === "en-ko" ? "영어를 듣고 한국어로 통역하세요" : "한국어를 듣고 영어로 통역하세요",
  PLAYBACK_BACK: (d) =>
    d === "en-ko" ? "내 통역을 듣고 영어로 재통역하세요" : "내 통역을 듣고 한국어로 재통역하세요",
  COMPARE: () => "원문과 비교하세요",
};

export function getSTTLocale(direction: Direction): string {
  return direction === "en-ko" ? "en-US" : "ko-KR";
}

export function getNextStep(current: SessionStep): SessionStep | null {
  const order: SessionStep[] = ["LISTEN_RECORD", "PLAYBACK_BACK", "COMPARE"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

export function getStepIndex(step: SessionStep): number {
  const order: SessionStep[] = ["LISTEN_RECORD", "PLAYBACK_BACK", "COMPARE"];
  return order.indexOf(step);
}
