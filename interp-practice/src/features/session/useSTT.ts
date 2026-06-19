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
  const finalTranscript = useRef("");
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    finalTranscript.current = "";
    setTranscript("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    onEndRef.current?.(finalTranscript.current);
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
    finalTranscript.current = "";
    setTranscript("");
    ExpoSpeechRecognitionModule.start({
      lang: getSTTLocale(direction),
      interimResults: true,
      continuous: false,
    });
  }, [direction]);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { transcript, isListening, startListening, stopListening };
}
