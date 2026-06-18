import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { getSentenceById, updateModelInterpretation, updateSentenceAudio } from "../../../src/db/sentences";
import { RecordButton } from "../../../src/components/RecordButton";
import { AudioPlayer } from "../../../src/components/AudioPlayer";
import type { SentenceEntry } from "../../../src/types";

export default function SentenceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sentence, setSentence] = useState<SentenceEntry | null>(null);
  const [modelKorean, setModelKorean] = useState("");
  const [modelEnglish, setModelEnglish] = useState("");
  const [saving, setSaving] = useState(false);
  const [recordingLang, setRecordingLang] = useState<"english" | "korean" | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    const s = await getSentenceById(id);
    if (s) {
      setSentence(s);
      setModelKorean(s.modelKorean ?? "");
      setModelEnglish(s.modelEnglish ?? "");
    }
  }

  async function handleSaveModel() {
    if (!sentence) return;
    setSaving(true);
    await updateModelInterpretation(id, modelKorean || undefined, modelEnglish || undefined);
    setSaving(false);
    Alert.alert("저장됨", "모범 통역이 저장됐습니다.");
  }

  async function handleRecordingComplete(uri: string) {
    if (!recordingLang) return;
    await updateSentenceAudio(id, recordingLang, uri);
    setRecordingLang(null);
    await load();
    Alert.alert("저장됨", `${recordingLang === "english" ? "영어" : "한국어"} 음성이 저장됐습니다.`);
  }

  if (!sentence) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: sentence.id, headerBackTitle: "목록" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>영어 원문</Text>
          <Text style={styles.sourceText}>{sentence.englishText}</Text>
          <View style={styles.audioRow}>
            <AudioPlayer
              source={
                sentence.englishAudio?.type === "file"
                  ? { type: "file", uri: sentence.englishAudio.uri }
                  : { type: "tts", text: sentence.englishText, language: "en-US" }
              }
            />
            <TouchableOpacity
              style={styles.recordAudioBtn}
              onPress={() => setRecordingLang(recordingLang === "english" ? null : "english")}
            >
              <Text style={styles.recordAudioBtnText}>
                {sentence.englishAudio?.type === "file" ? "🎙️ 재녹음" : "🎙️ 직접 녹음"}
              </Text>
            </TouchableOpacity>
          </View>
          {recordingLang === "english" && (
            <View style={styles.recorderBox}>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </View>
          )}
        </View>

        {sentence.koreanText && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>한국어 원문</Text>
            <Text style={styles.sourceText}>{sentence.koreanText}</Text>
            <View style={styles.audioRow}>
              <AudioPlayer
                source={
                  sentence.koreanAudio?.type === "file"
                    ? { type: "file", uri: sentence.koreanAudio.uri }
                    : { type: "tts", text: sentence.koreanText, language: "ko-KR" }
                }
              />
              <TouchableOpacity
                style={styles.recordAudioBtn}
                onPress={() => setRecordingLang(recordingLang === "korean" ? null : "korean")}
              >
                <Text style={styles.recordAudioBtnText}>
                  {sentence.koreanAudio?.type === "file" ? "🎙️ 재녹음" : "🎙️ 직접 녹음"}
                </Text>
              </TouchableOpacity>
            </View>
            {recordingLang === "korean" && (
              <View style={styles.recorderBox}>
                <RecordButton onRecordingComplete={handleRecordingComplete} />
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>모범 한국어 통역 (영→한)</Text>
          <TextInput
            style={styles.modelInput}
            multiline
            placeholder="영→한 세션에서 Step 5에 표시될 모범 통역문을 입력하세요"
            placeholderTextColor="#9CA3AF"
            value={modelKorean}
            onChangeText={setModelKorean}
          />
        </View>

        {sentence.koreanText && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>모범 영어 통역 (한→영)</Text>
            <TextInput
              style={styles.modelInput}
              multiline
              placeholder="한→영 세션에서 Step 5에 표시될 모범 통역문을 입력하세요"
              placeholderTextColor="#9CA3AF"
              value={modelEnglish}
              onChangeText={setModelEnglish}
            />
          </View>
        )}

        <View style={styles.metaSection}>
          <Text style={styles.metaText}>카테고리: {sentence.category}</Text>
          <Text style={styles.metaText}>
            난이도: {"★".repeat(sentence.difficulty) + "☆".repeat(3 - sentence.difficulty)}
          </Text>
          {sentence.tags.length > 0 && (
            <Text style={styles.metaText}>태그: {sentence.tags.join(", ")}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSaveModel}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>모범 통역 저장</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, gap: 0, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sourceText: { fontSize: 17, lineHeight: 26, color: "#111827" },
  audioRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  recordAudioBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  recordAudioBtnText: { fontSize: 13, color: "#374151" },
  recorderBox: {
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modelInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#111827",
    minHeight: 100,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  metaSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    gap: 4,
    marginBottom: 20,
  },
  metaText: { fontSize: 13, color: "#6B7280" },
  saveBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
