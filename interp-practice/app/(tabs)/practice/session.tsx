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
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
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
import { updateSentenceDifficulty } from "../../../src/db/sentences";
import { getSetting } from "../../../src/db/settings";
import type { SessionStep } from "../../../src/types";
import { DIFFICULTY_OPTIONS } from "../../../src/types";

export default function SessionScreen() {
  const router = useRouter();
  const { sentence, direction, step, interpRecordingUri, backInterpRecordingUri, backInterpText,
    queue, queueIndex, setStep, setInterpRecordingUri, setBackInterpRecordingUri, setBackInterpText,
    advanceQueue, reset } = useSessionStore();

  // STT auto-advances to COMPARE when recognition ends
  const { transcript, isListening, startListening, stopListening } = useSTT(
    direction,
    (text) => {
      setBackInterpText(text);
      const next = getNextStep("PLAYBACK_BACK");
      if (next) setStep(next);
    }
  );

  const [notes, setNotes] = useState("");
  const [showSourceText, setShowSourceText] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const appState = useRef(AppState.currentState);

  const sttPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sttPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(sttPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      sttPulse.stopAnimation();
      sttPulse.setValue(1);
    }
  }, [isListening]);

  useEffect(() => {
    setNotes("");
    setSessionSaved(false);
  }, [sentence?.id, direction]);

  useEffect(() => {
    if (!sentence) {
      router.replace("/practice");
      return;
    }
    activateKeepAwakeAsync();
    loadSettings();
    const sub = AppState.addEventListener("change", (nextState) => {
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
  const s = sentence;

  const sourceText = direction === "en-ko" ? s.englishText : s.koreanText ?? "";
  const sourceLang = direction === "en-ko" ? "en-US" : "ko-KR";
  const sourceAudio = direction === "en-ko" ? s.englishAudio : s.koreanAudio;
  const modelInterp = direction === "en-ko"
    ? (s.modelKorean ?? s.koreanText)
    : (s.modelEnglish ?? s.englishText);
  if (!sourceText) return null;

  function handleInterpComplete(uri: string) {
    setInterpRecordingUri(uri);
    const next = getNextStep("LISTEN_RECORD");
    if (next) setStep(next);
  }

  function handleBackStart() {
    startListening();
  }

  function handleBackComplete(uri: string) {
    setBackInterpRecordingUri(uri);
    stopListening(); // triggers STT onEnd → setBackInterpText + advance
  }

  async function handleScheduleReview(days: number, difficulty: 1 | 2 | 3) {
    if (sessionSaved) return;
    setSessionSaved(true);
    const result = {
      id: `${s.id}_${direction}_${Date.now()}`,
      sentenceId: s.id,
      direction,
      timestamp: Date.now(),
      interpRecordingUri: interpRecordingUri ?? undefined,
      backInterpRecordingUri: backInterpRecordingUri ?? undefined,
      backInterpText,
      originalText: sourceText,
      notes: notes.trim() || undefined,
    };
    await saveResult(result);
    await scheduleReview(s.id, direction, days);
    await updateSentenceDifficulty(s.id, difficulty);
    const hasNext = advanceQueue();
    if (!hasNext) {
      const total = queue.length;
      reset();
      Alert.alert("완료!", `${total}문장 학습 완료 🎉`, [
        { text: "확인", onPress: () => router.replace("/practice") },
      ]);
    }
  }

  function handleRetry() {
    setStep("LISTEN_RECORD");
    setInterpRecordingUri("");
    setBackInterpRecordingUri("");
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
        onPress: () => { reset(); router.replace("/practice"); },
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
        <View style={styles.gnb}>
          <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
            <Text style={styles.exitText}>나가기</Text>
          </TouchableOpacity>
          {queue.length > 1 && (
            <Text style={styles.queueCounter}>{queueIndex + 1} / {queue.length}</Text>
          )}
        </View>
        <StepIndicator currentStep={step} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* Step 1: 원문 듣기 + 통역 녹음 */}
        {step === "LISTEN_RECORD" && (
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
            <View style={styles.divider} />
            <Text style={styles.subLabel}>준비되면 통역을 녹음하세요</Text>
            <RecordButton onRecordingComplete={handleInterpComplete} />
          </View>
        )}

        {/* Step 2: 내 통역 듣기 + 재통역 녹음(RecordButton) + STT */}
        {step === "PLAYBACK_BACK" && interpRecordingUri && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            <AudioPlayer source={{ type: "file", uri: interpRecordingUri }} />
            <View style={styles.divider} />
            <Text style={styles.subLabel}>준비되면 재통역을 녹음하세요</Text>
            {isListening && transcript ? (
              <View style={styles.liveTranscript}>
                <Text style={styles.liveTranscriptText}>{transcript}</Text>
              </View>
            ) : null}
            <RecordButton
              onRecordingStart={handleBackStart}
              onRecordingComplete={handleBackComplete}
            />
          </View>
        )}

        {/* Step 3: 비교 */}
        {step === "COMPARE" && (
          <View style={styles.compareContainer}>
            {(interpRecordingUri || backInterpRecordingUri) ? (
              <View style={styles.replaySection}>
                {interpRecordingUri ? (
                  <>
                    <Text style={styles.replaySectionLabel}>통역 녹음</Text>
                    <AudioPlayer source={{ type: "file", uri: interpRecordingUri }} />
                  </>
                ) : null}
                {backInterpRecordingUri ? (
                  <>
                    <Text style={[styles.replaySectionLabel, { marginTop: 10 }]}>재통역 녹음</Text>
                    <AudioPlayer source={{ type: "file", uri: backInterpRecordingUri }} />
                  </>
                ) : null}
              </View>
            ) : null}
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
              <Text style={styles.reviewLabel}>이 문장 얼마나 어려웠나요?</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map(({ difficulty, label, days, sublabel }) => (
                  <TouchableOpacity
                    key={difficulty}
                    style={[
                      styles.difficultyBtn,
                      difficulty === 3 && styles.diffHard,
                      difficulty === 2 && styles.diffMed,
                      difficulty === 1 && styles.diffEasy,
                    ]}
                    onPress={() => handleScheduleReview(days, difficulty)}
                    disabled={sessionSaved}
                  >
                    <Text style={styles.difficultyStars}>{label}</Text>
                    <Text style={styles.difficultySublabel}>{sublabel}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>다시 연습</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  gnb: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 44,
  },
  exitBtn: { padding: 4 },
  exitText: { fontSize: 15, fontWeight: "500", color: "#6B7280" },
  queueCounter: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, padding: 24 },
  stepContent: { flex: 1, alignItems: "center", gap: 20, paddingTop: 24 },
  stepDesc: { fontSize: 20, fontWeight: "600", color: "#111827", textAlign: "center" },
  textBox: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 20, width: "100%", borderWidth: 1, borderColor: "#E5E7EB" },
  sourceText: { fontSize: 18, lineHeight: 28, color: "#111827", textAlign: "center" },
  divider: { width: "100%", height: 1, backgroundColor: "#F3F4F6", marginVertical: 4 },
  subLabel: { fontSize: 13, color: "#9CA3AF" },
  liveTranscript: { backgroundColor: "#F0F9FF", borderRadius: 12, padding: 16, width: "100%", borderWidth: 1, borderColor: "#BAE6FD" },
  liveTranscriptText: { fontSize: 15, color: "#0369A1", lineHeight: 22 },
  compareContainer: { flex: 1, gap: 0 },
  replaySection: { marginBottom: 16 },
  replaySectionLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 8 },
  notesSection: { marginTop: 16 },
  notesLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 8 },
  notesInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 15, color: "#111827", minHeight: 80, textAlignVertical: "top" },
  reviewSection: { marginTop: 20 },
  reviewLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 12, textAlign: "center" },
  difficultyRow: { flexDirection: "row", gap: 8 },
  difficultyBtn: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  diffHard: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  diffMed:  { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  diffEasy: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  difficultyStars: { fontSize: 13, fontWeight: "700", color: "#374151" },
  difficultySublabel: { fontSize: 11, color: "#6B7280" },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  retryBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
});
