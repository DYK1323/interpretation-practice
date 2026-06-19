import { create } from "zustand";
import type { SentenceEntry, Direction, SessionStep } from "../../types";

export interface QueueItem {
  sentence: SentenceEntry;
  direction: Direction;
}

interface SessionState {
  sentence: SentenceEntry | null;
  direction: Direction;
  step: SessionStep;
  interpRecordingUri: string | null;
  backInterpText: string;
  isPlaying: boolean;
  isRecording: boolean;

  queue: QueueItem[];
  queueIndex: number;

  startSession: (sentence: SentenceEntry, direction: Direction) => void;
  startQueue: (items: QueueItem[]) => void;
  advanceQueue: () => boolean;
  setStep: (step: SessionStep) => void;
  setInterpRecordingUri: (uri: string) => void;
  setBackInterpText: (text: string) => void;
  setIsPlaying: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  reset: () => void;
}

const INITIAL_STEP_STATE = {
  step: "LISTEN_SOURCE" as SessionStep,
  interpRecordingUri: null,
  backInterpText: "",
  isPlaying: false,
  isRecording: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sentence: null,
  direction: "en-ko",
  queue: [],
  queueIndex: 0,
  ...INITIAL_STEP_STATE,

  startSession: (sentence, direction) =>
    set({ sentence, direction, queue: [{ sentence, direction }], queueIndex: 0, ...INITIAL_STEP_STATE }),

  startQueue: (items) => {
    if (items.length === 0) return;
    set({
      queue: items,
      queueIndex: 0,
      sentence: items[0].sentence,
      direction: items[0].direction,
      ...INITIAL_STEP_STATE,
    });
  },

  advanceQueue: () => {
    const { queue, queueIndex } = get();
    const next = queueIndex + 1;
    if (next < queue.length) {
      set({
        queueIndex: next,
        sentence: queue[next].sentence,
        direction: queue[next].direction,
        ...INITIAL_STEP_STATE,
      });
      return true;
    }
    return false;
  },

  setStep: (step) => set({ step }),
  setInterpRecordingUri: (uri) => set({ interpRecordingUri: uri }),
  setBackInterpText: (text) => set({ backInterpText: text }),
  setIsPlaying: (val) => set({ isPlaying: val }),
  setIsRecording: (val) => set({ isRecording: val }),
  reset: () => set({ sentence: null, queue: [], queueIndex: 0, ...INITIAL_STEP_STATE }),
}));
