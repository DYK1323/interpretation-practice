import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StepIndicator } from "../../../src/components/StepIndicator";
import { AudioPlayer } from "../../../src/components/AudioPlayer";
import { RecordButton } from "../../../src/components/RecordButton";
import { CompareView } from "../../../src/components/CompareView";
import { useSessionStore } from "../../../src/features/session/useSessionStore";
import { useSTT } from "../../../src/features/session/useSTT";
import { getNextStep, STEP_DESCRIPTIONS } from "../../../src/features/session/sessionMachine";
import { saveResult } from "../../../src/db/results";
import { scheduleReview, getProgress } from "../../../src/db/progress";
import { updateSentenceDifficulty } from "../../../src/db/sentences";
import { getSetting } from "../../../src/db/settings";
import type { SessionStep } from "../../../src/types/index";
import { DIFFICULTY_OPTIONS } from "../../../src/types/index";

export default function SessionScreen() {
  const router = useRouter();
  const { sentence, direction, step, interpRecordingUri, backInterpRecordingUri, backInterpText,
    queue, queueIndex, setStep, setInterpRecordingUri, setBackInterpRecordingUri, setBackInterpText,
    advanceQueue, requeueAndAdvance, saveInterpAndAdvanceSplit, reset } = useSessionStore();

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
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [splitSessionMode, setSplitSessionMode] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const appState = useRef(AppState.currentState);
  const mountedRef = useRef(true);
  const originalQueueLengthRef = useRef(0);
  useEffect(() => () => { mountedRef.current = false; }, []);

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
  }, [sentence?.id, direction, queueIndex]);

  useEffect(() => {
    if (queue.length > 0 && !queue[0].isRetry) {
      originalQueueLengthRef.current = queue.length;
    }
  }, [queue[0]?.sentence.id]);

  useEffect(() => {
    if (!sentence) {
      router.replace("/practice");
      return;
    }
    activateKeepAwakeAsync();
    const sub = AppState.addEventListener("change", (nextState) => {
      appState.current = nextState;
    });
    return () => {
      deactivateKeepAwake();
      sub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      getSetting("showSourceTextDuringListen").then(setShowSourceText);
      getSetting("playbackSpeed").then(setPlaybackSpeed);
      getSetting("splitSessionMode").then(setSplitSessionMode);
    }, [])
  );

  if (!sentence) return null;
  const s = sentence;

  function getSourceInfo() {
    switch (direction) {
      case "en-ko": return { text: s.englishText,       audio: s.englishAudio,  lang: "en-US" };
      case "ko-en":
      case "ko-ja":
      case "ko-zh": return { text: s.koreanText ?? "",  audio: s.koreanAudio,   lang: "ko-KR" };
      case "ja-ko": return { text: s.japaneseText ?? "", audio: s.japaneseAudio, lang: "ja-JP" };
      case "zh-ko": return { text: s.chineseText ?? "",  audio: s.chineseAudio,  lang: "zh-CN" };
    }
  }

  function getModelInterp() {
    switch (direction) {
      case "en-ko":
      case "ja-ko":
      case "zh-ko": return s.modelKorean ?? s.koreanText;
      case "ko-en": return s.modelEnglish ?? s.englishText;
      case "ko-ja": return s.modelJapanese ?? s.japaneseText;
      case "ko-zh": return s.modelChinese ?? s.chineseText;
    }
  }

  const { text: sourceText, audio: sourceAudio, lang: sourceLang } = getSourceInfo();
  const modelInterp = getModelInterp();
  if (!sourceText) return null;

  function handleInterpComplete(uri: string) {
    if (splitSessionMode && queueIndex < originalQueueLengthRef.current) {
      saveInterpAndAdvanceSplit(uri, originalQueueLengthRef.current);
    } else {
      setInterpRecordingUri(uri);
      const next = getNextStep("LISTEN_RECORD");
      if (next) setStep(next);
    }
  }

  function handleBackStart() {
    startListening();
  }

  function handleBackComplete(uri: string) {
    setBackInterpRecordingUri(uri);
    stopListening();
  }

  async function handleScheduleReview(difficulty: 1 | 2 | 3) {
    if (sessionSaved) return;
    setSessionSaved(true);

    await saveResult({
      id: `${s.id}_${direction}_${Date.now()}`,
      sentenceId: s.id,
      direction,
      timestamp: Date.now(),
      interpRecordingUri: interpRecordingUri ?? undefined,
      backInterpRecordingUri: backInterpRecordingUri ?? undefined,
      backInterpText,
      originalText: sourceText,
      notes: notes.trim() || undefined,
    });

    const isRetry = queue[queueIndex]?.isRetry ?? false;

    if (difficulty === 3) {
      if (!isRetry) {
        await scheduleReview(s.id, direction, 0);
      }
      if (!mountedRef.current) return;
      requeueAndAdvance();
      return;
    }

    let days: number;
    if (isRetry) {
      days = difficulty === 2 ? 1 : 3;
    } else {
      const progress = await getProgress(s.id, direction);
      if (progress && progress.intervalDays > 0) {
        const multiplier = difficulty === 2 ? 2.5 : 3.5;
        days = Math.max(1, Math.round(progress.intervalDays * multiplier));
      } else {
        days = difficulty === 2 ? 1 : 3;
      }
    }
    await scheduleReview(s.id, direction, days);
    await updateSentenceDifficulty(s.id, difficulty);

    if (!mountedRef.current) return;
    const hasNext = advanceQueue();
    if (!hasNext) {
      const total = originalQueueLengthRef.current || queue.length;
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

  const origLen = originalQueueLengthRef.current || queue.length;
  const isReviewPass = splitSessionMode && queueIndex >= origLen;
  const passLabel = splitSessionMode ? (isReviewPass ? "복습" : "통역") : null;
  const displayIndex = isReviewPass ? queueIndex - origLen : queueIndex;
  const displayTotal = splitSessionMode ? origLen : queue.length;

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
          <View style={styles.gnbRight}>
            {queue[queueIndex]?.isRetry && (
              <View style={styles.retryBadge}>
                <Text style={styles.retryBadgeText}>재도전</Text>
              </View>
            )}
            {queue.length > 1 && (
              <Text style={styles.queueCounter}>
                {passLabel ? `${passLabel} ` : ""}{displayIndex + 1} / {displayTotal}
              </Text>
            )}
          </View>
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
              speed={playbackSpeed}
            />
            <View style={styles.divider} />
            <Text style={styles.subLabel}>준비되면 통역을 녹음하세요</Text>
            <RecordButton onRecordingComplete={handleInterpComplete} />
          </View>
        )}

        {/* Step 2: 내 통역 듣기 + 재통역 녹음(RecordButton) + STT */}
        {step === "PLAYBACK_BACK" && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>{stepDesc}</Text>
            {interpRecordingUri ? (
              <AudioPlayer source={{ type: "file", uri: interpRecordingUri }} />
            ) : (
              <Text style={styles.errorText}>녹음이 없습니다. 이전 단계로 돌아가세요.</Text>
            )}
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
                  <View style={styles.replayItem}>
                    <Text style={styles.replaySectionLabel}>통역 녹음</Text>
                    <AudioPlayer source={{ type: "file", uri: interpRecordingUri }} />
                  </View>
                ) : null}
                {backInterpRecordingUri ? (
                  <View style={styles.replayItem}>
                    <Text style={styles.replaySectionLabel}>재통역 녹음</Text>
                    <AudioPlayer source={{ type: "file", uri: backInterpRecordingUri }} />
                  </View>
                ) : null}
              </View>
            ) : null}
            <CompareView
              originalText={sourceText}
              backInterpText={backInterpText}
              direction={direction}
              modelInterpretation={modelInterp}
            />
            {!backInterpText && (
              <TextInput
                style={styles.sttFallbackInput}
                placeholder="STT 미인식 — 직접 입력"
                placeholderTextColor="#9CA3AF"
                onChangeText={setBackInterpText}
                multiline
              />
            )}
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
                {DIFFICULTY_OPTIONS.map(({ difficulty, label, sublabel }) => (
                  <TouchableOpacity
                    key={difficulty}
                    style={[
                      styles.difficultyBtn,
                      difficulty === 3 && styles.diffHard,
                      difficulty === 2 && styles.diffMed,
                      difficulty === 1 && styles.diffEasy,
                    ]}
                    onPress={() => handleScheduleReview(difficulty)}
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
  gnbRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  queueCounter: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  retryBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  retryBadgeText: { fontSize: 11, color: "#D97706", fontWeight: "700" },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, padding: 24 },
  stepContent: { flex: 1, alignItems: "center", gap: 20, paddingTop: 24 },
  stepDesc: { fontSize: 20, fontWeight: "600", color: "#111827", textAlign: "center" },
  textBox: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 20, width: "100%", borderWidth: 1, borderColor: "#E5E7EB" },
  sourceText: { fontSize: 18, lineHeight: 28, color: "#111827", textAlign: "center" },
  divider: { width: "100%", height: 1, backgroundColor: "#F3F4F6", marginVertical: 4 },
  subLabel: { fontSize: 13, color: "#9CA3AF" },
  errorText: { fontSize: 14, color: "#EF4444", textAlign: "center" },
  liveTranscript: { backgroundColor: "#F0F9FF", borderRadius: 12, padding: 16, width: "100%", borderWidth: 1, borderColor: "#BAE6FD" },
  liveTranscriptText: { fontSize: 15, color: "#0369A1", lineHeight: 22 },
  compareContainer: { flex: 1, gap: 0 },
  replaySection: { flexDirection: "row", gap: 10, marginBottom: 16 },
  replayItem: { flex: 1, gap: 6 },
  replaySectionLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  sttFallbackInput: {
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
    minHeight: 60,
    textAlignVertical: "top",
    backgroundColor: "#FFFBEB",
    marginBottom: 16,
  },
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
