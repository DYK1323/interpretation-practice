import { useState, useCallback, useRef } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { Direction } from "../../types";
import { getSTTLocale } from "./sessionMachine";

export function useSTT(direction: Direction, onEnd?: (text: string) => void) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Text from completed sessions (before auto-restart)
  const accumulatedRef = useRef("");
  // Final text from the current active session
  const currentFinalRef = useRef("");
  const isListeningRef = useRef(false);
  // true while user wants STT running; auto-restart fires only when true
  const activeRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const getFullText = () =>
    [accumulatedRef.current, currentFinalRef.current].filter(Boolean).join(" ");

  useSpeechRecognitionEvent("start", () => {
    isListeningRef.current = true;
    setIsListening(true);
    currentFinalRef.current = "";
  });

  useSpeechRecognitionEvent("end", () => {
    isListeningRef.current = false;
    setIsListening(false);

    if (activeRef.current) {
      // Silence timeout ended the session — save segment and auto-restart
      accumulatedRef.current = getFullText();
      currentFinalRef.current = "";
      setTimeout(() => {
        if (activeRef.current) {
          ExpoSpeechRecognitionModule.start({
            lang: getSTTLocale(direction),
            interimResults: true,
            continuous: true,
          });
        }
      }, 150);
    } else {
      onEndRef.current?.(getFullText().trim());
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      currentFinalRef.current = text;
    }
    setTranscript([accumulatedRef.current, text].filter(Boolean).join(" "));
  });

  useSpeechRecognitionEvent("error", (event) => {
    isListeningRef.current = false;
    setIsListening(false);
    console.warn("STT error:", event.error);
    if (activeRef.current) {
      setTimeout(() => {
        if (activeRef.current) {
          ExpoSpeechRecognitionModule.start({
            lang: getSTTLocale(direction),
            interimResults: true,
            continuous: true,
          });
        }
      }, 500);
    }
  });

  const startListening = useCallback(() => {
    accumulatedRef.current = "";
    currentFinalRef.current = "";
    activeRef.current = true;
    setTranscript("");
    ExpoSpeechRecognitionModule.start({
      lang: getSTTLocale(direction),
      interimResults: true,
      continuous: true,
    });
  }, [direction]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (isListeningRef.current) {
      ExpoSpeechRecognitionModule.stop();
      // end event will fire → activeRef=false → calls onEnd
    } else {
      // STT already stopped (in the 150ms restart gap) — fire onEnd directly
      // The pending setTimeout checks activeRef before restarting, so no double-call
      onEndRef.current?.(getFullText().trim());
    }
  }, []);

  return { transcript, isListening, startListening, stopListening };
}
