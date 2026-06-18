import { useState, useCallback, useRef } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { Direction } from "../../types";
import { getSTTLocale } from "./sessionMachine";

export function useSTT(direction: Direction) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const finalTranscript = useRef("");

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    finalTranscript.current = "";
    setTranscript("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);
    if (event.isFinal) {
      finalTranscript.current = text;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    console.warn("STT error:", event.error);
  });

  const startListening = useCallback(() => {
    ExpoSpeechRecognitionModule.start({
      lang: getSTTLocale(direction),
      interimResults: true,
      continuous: false,
    });
  }, [direction]);

  const stopListening = useCallback((): string => {
    ExpoSpeechRecognitionModule.stop();
    return finalTranscript.current;
  }, []);

  return { transcript, isListening, startListening, stopListening };
}
