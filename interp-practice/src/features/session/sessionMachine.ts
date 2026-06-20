import type { SessionStep, Direction } from "../../types";
import { LANG_LABEL } from "../../constants";

export const STEP_LABELS: Record<SessionStep, string> = {
  LISTEN_RECORD: "듣기/통역",
  PLAYBACK_BACK: "확인/재통역",
  COMPARE: "비교",
};

export const STEP_DESCRIPTIONS: Record<SessionStep, (dir: Direction) => string> = {
  LISTEN_RECORD: (d) => {
    const [src, tgt] = d.split("-");
    return `${LANG_LABEL[src]}를 듣고 ${LANG_LABEL[tgt]}로 통역하세요`;
  },
  PLAYBACK_BACK: (d) => {
    const [src] = d.split("-");
    return `내 통역을 듣고 ${LANG_LABEL[src]}로 재통역하세요`;
  },
  COMPARE: () => "원문과 비교하세요",
};

const STT_LOCALE: Record<Direction, string> = {
  "en-ko": "en-US",
  "ko-en": "ko-KR",
  "ja-ko": "ja-JP",
  "ko-ja": "ko-KR",
  "zh-ko": "zh-CN",
  "ko-zh": "ko-KR",
};

export function getSTTLocale(direction: Direction): string {
  return STT_LOCALE[direction];
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
