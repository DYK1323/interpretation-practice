import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StepIndicator } from "../../../src/components/StepIndicator";
import { AudioPlayer } from "../../../src/components/AudioPlayer";
import { RecordButton } from "../../../src/components/RecordButton";
import { CompareView } from "../../../src/components/CompareView";
import { useSessionStore } from "../../../src/features/session/useSessionStore";
import { useSTT } from "../../../src/features/session/useSTT";
import { getNextStep, STEP_DESCRIPTIONS } from "../../../src/features/session/sessionMachine";
import { saveResult } from "../../../src/db/results";
import { scheduleReview } from "../../../src/db/progress";
import { getSetting } from "../../../src/db/settings";
import type { SessionStep, ReviewInterval } from "../../../src/types";
import { REVIEW_INTERVALS } from "../../../src/types";

const INTERVAL_LABELS: Record<ReviewInterval, string> = {
  1: "내일",
  3: "3일",
  7: "1주",
  14: "2주",
  30: "한 달",
};

export default function SessionScreen() {
  const router = useRouter();
  const { sentence, direction, step, interpRecordingUri, backInterpText, setStep, setInterpRecordingUri, setBackInterpText, reset } =
    useSessionStore();
  const { transcript, isListening, startListening, stopListening } = useSTT(direction);
  const [notes, setNotes] = useState("");
  const [showSourceText, setShowSourceText] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!sentence) {
      router.replace("/practice");
      return;
    }
    activateKeepAwakeAsync();
    loadSettings();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current === "active" && nextState !== "active") {
        // App backgrounded during recording — stop will be handled by OS
      }
      appState.current = nextState;
    });

    return () => {
      deactivateKeepAwake();
      sub.remove();
    };
  }, []);

  async function loadSettings() {
    const show = await getSetting("showSourceTextDuringListen");
    setShowSourceText(show);
  }

  if (!sentence) return null;
  const s = sentence; // non-null alias for use in closures

  const sourceText =
    direction === "en-ko" ? s.englishText : s.koreanText ?? "";
  const sourceLang = direction === "en-ko" ? "en-US" : "ko-KR";
  const sourceAudio =
    direction === "en-ko" ? s.englishAudio : s.koreanAudio;
  const modelInterp =
    direction === "en-ko" ? s.modelKorean : s.modelEnglish;
  if (!sourceText) return null;

  function advance() {
    const next = getNextStep(step);
    if (next) setStep(next);
  }

  function handleRecordInterpComplete(uri: string) {
    setInterpRecordingUri(uri);
    advance();
  }

  function handleRecordBackStart() {
    startListening();
  }

  function handleRecordBackComplete(uri: string) {
    const finalText = stopListening();
    setBackInterpText(finalText || transcript);
    advance();
  }

  async function handleScheduleReview(intervalDays: ReviewInterval) {
    if (sessionSaved) return;
    setSessionSaved(true);

    const result = {
      id: `${s.id}_${direction}_${Date.now()}`,
      sentenceId: s.id,
      direction,
      timestamp: Date.now(),
      interpRecordingUri: interpRecordingUri ?? undefined,
      backInterpText: backInterpText,
      originalText: sourceText,
      notes: notes.trim() || undefined,
    };

    await saveResult(result);
    await scheduleReview(s.id, direction, intervalDays);
    router.replace("/practice");
  }

  function handleRetry() {
    setStep("LISTEN_SOURCE");
    setInterpRecordingUri("");
    setBackInterpText("");
    setNotes("");
    setSessionSaved(false);
  }

  function handleExit() {
    Alert.alert("세션 종료", "현재 진행 중인 세션을 종료할까요?", [
      { text: "계속하기", style: "cancel" },
      {
        text: "종료",
        style: "destructive",
        onPress: () => {
          reset();
          router.replace("/practice");
        },
      },
    ]);
  }

  const stepDesc = STEP_DESCRIPTIONS[step](direction);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        <StepIndicator currentStep={step} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === "LISTEN_SOURCE" && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            {showSourceText && (
              <View style={styles.textBox}>
                <Text style={styles.sourceText}>{sourceText}</Text>
              </View>
            )}
            <AudioPlayer
              source={
                sourceAudio?.type === "file"
                  ? { type: "file", uri: sourceAudio.uri }
                  : { type: "tts", text: sourceText, language: sourceLang }
              }
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={advance}>
              <Text style={styles.primaryBtnText}>통역 준비됐어요 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "RECORD_INTERP" && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            <RecordButton
              onRecordingComplete={handleRecordInterpComplete}
              onRecordingStart={() => {}}
            />
          </View>
        )}

        {step === "PLAYBACK_INTERP" && interpRecordingUri && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            <AudioPlayer source={{ type: "file", uri: interpRecordingUri }} />
            <TouchableOpacity style={styles.primaryBtn} onPress={advance}>
              <Text style={styles.primaryBtnText}>재통역 준비됐어요 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "RECORD_BACK" && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            {isListening && transcript ? (
              <View style={styles.liveTranscript}>
                <Text style={styles.liveTranscriptText}>{transcript}</Text>
              </View>
            ) : null}
            <RecordButton
              onRecordingStart={handleRecordBackStart}
              onRecordingComplete={handleRecordBackComplete}
            />
          </View>
        )}

        {step === "COMPARE" && (
          <View style={styles.compareContainer}>
            <CompareView
              originalText={sourceText}
              backInterpText={backInterpText}
              direction={direction}
              modelInterpretation={modelInterp}
            />

            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>메모</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="학습 메모를 입력하세요..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>다음에 다시 볼까요?</Text>
              <View style={styles.intervalRow}>
                {REVIEW_INTERVALS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={styles.intervalBtn}
                    onPress={() => handleScheduleReview(days)}
                    disabled={sessionSaved}
                  >
                    <Text style={styles.intervalBtnText}>{INTERVAL_LABELS[days]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleRetry}>
                <Text style={styles.secondaryBtnText}>다시 연습</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingTop: 8,
  },
  exitBtn: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  exitText: { fontSize: 18, color: "#9CA3AF" },
  body: { flex: 1 },
  bodyContent: {
    flexGrow: 1,
    padding: 24,
  },
  stepContent: {
    flex: 1,
    alignItems: "center",
    gap: 32,
    paddingTop: 32,
  },
  stepDesc: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  textBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sourceText: {
    fontSize: 18,
    lineHeight: 28,
    color: "#111827",
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  liveTranscript: {
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  liveTranscriptText: { fontSize: 15, color: "#0369A1", lineHeight: 22 },
  compareContainer: { flex: 1, gap: 0 },
  notesSection: { marginTop: 16 },
  notesLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  reviewSection: { marginTop: 20 },
  reviewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
    textAlign: "center",
  },
  intervalRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  intervalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#EBF2FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  intervalBtnText: { fontSize: 14, fontWeight: "600", color: "#1A56DB" },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    justifyContent: "center",
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
});
