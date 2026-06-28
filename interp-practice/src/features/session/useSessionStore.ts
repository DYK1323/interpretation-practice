import { create } from "zustand";
import type { SentenceEntry, Direction, SessionStep } from "../../types";

export interface QueueItem {
  sentence: SentenceEntry;
  direction: Direction;
  isRetry?: boolean;
  interpRecordingUri?: string;
}

interface SessionState {
  sentence: SentenceEntry | null;
  direction: Direction;
  step: SessionStep;
  interpRecordingUri: string | null;
  backInterpRecordingUri: string | null;
  backInterpText: string;
  isPlaying: boolean;
  isRecording: boolean;

  queue: QueueItem[];
  queueIndex: number;
  pendingSplitUri: string | null;

  startSession: (sentence: SentenceEntry, direction: Direction) => void;
  startQueue: (items: QueueItem[]) => void;
  advanceQueue: () => boolean;
  requeueAndAdvance: () => void;
  saveInterpAndAdvanceSplit: (uri: string, originalLength: number) => void;
  setStep: (step: SessionStep) => void;
  setInterpRecordingUri: (uri: string) => void;
  setBackInterpRecordingUri: (uri: string) => void;
  setBackInterpText: (text: string) => void;
  setIsPlaying: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  setPendingSplitUri: (uri: string | null) => void;
  reset: () => void;
}

const INITIAL_STEP_STATE = {
  step: "LISTEN_RECORD" as SessionStep,
  interpRecordingUri: null,
  backInterpRecordingUri: null,
  backInterpText: "",
  isPlaying: false,
  isRecording: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sentence: null,
  direction: "en-ko",
  queue: [],
  queueIndex: 0,
  pendingSplitUri: null,
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
      const nextItem = queue[next];
      const hasPreRecorded = !!nextItem.interpRecordingUri;
      set({
        queueIndex: next,
        sentence: nextItem.sentence,
        direction: nextItem.direction,
        step: hasPreRecorded ? "PLAYBACK_BACK" : "LISTEN_RECORD",
        interpRecordingUri: nextItem.interpRecordingUri ?? null,
        backInterpRecordingUri: null,
        backInterpText: "",
        isPlaying: false,
        isRecording: false,
      });
      return true;
    }
    return false;
  },

  requeueAndAdvance: () => {
    const { queue, queueIndex } = get();
    const cur = queue[queueIndex];
    if (!cur) return;
    const newQueue = [...queue, { ...cur, isRetry: true, interpRecordingUri: undefined }];
    const next = queueIndex + 1;
    set({
      queue: newQueue,
      queueIndex: next,
      sentence: newQueue[next].sentence,
      direction: newQueue[next].direction,
      ...INITIAL_STEP_STATE,
    });
  },

  saveInterpAndAdvanceSplit: (uri: string, originalLength: number) => {
    const { queue, queueIndex } = get();
    const updatedQueue = [...queue];
    updatedQueue[queueIndex] = { ...updatedQueue[queueIndex], interpRecordingUri: uri };

    if (queueIndex < originalLength - 1) {
      const next = queueIndex + 1;
      set({
        queue: updatedQueue,
        queueIndex: next,
        sentence: updatedQueue[next].sentence,
        direction: updatedQueue[next].direction,
        ...INITIAL_STEP_STATE,
      });
    } else {
      const reviewItems = updatedQueue.slice(0, originalLength).map(item => ({ ...item, isRetry: false }));
      const fullQueue = [...updatedQueue, ...reviewItems];
      set({
        queue: fullQueue,
        queueIndex: originalLength,
        sentence: reviewItems[0].sentence,
        direction: reviewItems[0].direction,
        step: "PLAYBACK_BACK" as SessionStep,
        interpRecordingUri: reviewItems[0].interpRecordingUri ?? null,
        backInterpRecordingUri: null,
        backInterpText: "",
        isPlaying: false,
        isRecording: false,
      });
    }
  },

  setStep: (step) => set({ step }),
  setInterpRecordingUri: (uri) => set({ interpRecordingUri: uri }),
  setBackInterpRecordingUri: (uri) => set({ backInterpRecordingUri: uri }),
  setBackInterpText: (text) => set({ backInterpText: text }),
  setIsPlaying: (val) => set({ isPlaying: val }),
  setIsRecording: (val) => set({ isRecording: val }),
  setPendingSplitUri: (uri) => set({ pendingSplitUri: uri }),
  reset: () => set({ sentence: null, queue: [], queueIndex: 0, pendingSplitUri: null, ...INITIAL_STEP_STATE }),
}));
