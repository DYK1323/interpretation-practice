import { create } from "zustand";
import type { SentenceEntry, Direction, SessionStep } from "../../types";

interface SessionState {
  sentence: SentenceEntry | null;
  direction: Direction;
  step: SessionStep;
  interpRecordingUri: string | null;
  backInterpText: string;
  isPlaying: boolean;
  isRecording: boolean;

  startSession: (sentence: SentenceEntry, direction: Direction) => void;
  setStep: (step: SessionStep) => void;
  setInterpRecordingUri: (uri: string) => void;
  setBackInterpText: (text: string) => void;
  setIsPlaying: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sentence: null,
  direction: "en-ko",
  step: "LISTEN_SOURCE",
  interpRecordingUri: null,
  backInterpText: "",
  isPlaying: false,
  isRecording: false,

  startSession: (sentence, direction) =>
    set({
      sentence,
      direction,
      step: "LISTEN_SOURCE",
      interpRecordingUri: null,
      backInterpText: "",
      isPlaying: false,
      isRecording: false,
    }),

  setStep: (step) => set({ step }),
  setInterpRecordingUri: (uri) => set({ interpRecordingUri: uri }),
  setBackInterpText: (text) => set({ backInterpText: text }),
  setIsPlaying: (val) => set({ isPlaying: val }),
  setIsRecording: (val) => set({ isRecording: val }),
  reset: () =>
    set({
      sentence: null,
      step: "LISTEN_SOURCE",
      interpRecordingUri: null,
      backInterpText: "",
      isPlaying: false,
      isRecording: false,
    }),
}));
