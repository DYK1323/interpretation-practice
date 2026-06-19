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
import { getSentenceById, upsertSentence, updateSentenceAudio } from "../../../src/db/sentences";
import { RecordButton } from "../../../src/components/RecordButton";
import { AudioPlayer } from "../../../src/components/AudioPlayer";
import type { SentenceEntry, Category } from "../../../src/types";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "news",        label: "뉴스" },
  { value: "business",   label: "비즈니스" },
  { value: "conference", label: "컨퍼런스" },
  { value: "daily",      label: "일상" },
];

const DIFFICULTIES: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "★☆☆" },
  { value: 2, label: "★★☆" },
  { value: 3, label: "★★★" },
];

function makeNewId() {
  return `custom_${Date.now()}`;
}

export default function SentenceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [recordingLang, setRecordingLang] = useState<"english" | "korean" | null>(null);

  const [englishText, setEnglishText] = useState("");
  const [koreanText, setKoreanText] = useState("");
  const [category, setCategory] = useState<Category>("daily");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [tags, setTags] = useState("");
  const [modelKorean, setModelKorean] = useState("");
  const [modelEnglish, setModelEnglish] = useState("");
  const [notes, setNotes] = useState("");
  const [enAudio, setEnAudio] = useState<SentenceEntry["englishAudio"]>({ type: "tts" });
  const [koAudio, setKoAudio] = useState<SentenceEntry["koreanAudio"]>({ type: "tts" });

  useEffect(() => {
    if (!isNew && id) loadSentence(id);
  }, [id]);

  async function loadSentence(sentenceId: string) {
    setLoading(true);
    const s = await getSentenceById(sentenceId);
    if (s) {
      setEnglishText(s.englishText);
      setKoreanText(s.koreanText ?? "");
      setCategory(s.category);
      setDifficulty(s.difficulty);
      setTags(s.tags.join(", "));
      setModelKorean(s.modelKorean ?? "");
      setModelEnglish(s.modelEnglish ?? "");
      setNotes(s.notes ?? "");
      setEnAudio(s.englishAudio ?? { type: "tts" });
      setKoAudio(s.koreanAudio ?? { type: "tts" });
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!englishText.trim()) {
      Alert.alert("오류", "영어 원문을 입력해주세요.");
      return;
    }
    setSaving(true);
    const sentenceId = savedId ?? makeNewId();
    const entry: SentenceEntry = {
      id: sentenceId,
      category,
      difficulty,
      englishText: englishText.trim(),
      koreanText: koreanText.trim() || undefined,
      englishAudio: enAudio,
      koreanAudio: koAudio,
      modelKorean: modelKorean.trim() || undefined,
      modelEnglish: modelEnglish.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: notes.trim() || undefined,
    };
    try {
      await upsertSentence(entry);
      setSavedId(sentenceId);
      Alert.alert(
        "저장됨",
        isNew ? "새 문장이 추가됐습니다." : "수정 내용이 저장됐습니다.",
        [{ text: "확인", onPress: () => { if (isNew) router.back(); } }]
      );
    } catch (e: any) {
      Alert.alert("오류", `저장 실패: ${e?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordingComplete(uri: string) {
    if (!recordingLang || !savedId) return;
    await updateSentenceAudio(savedId, recordingLang, uri);
    if (recordingLang === "english") setEnAudio({ type: "file", uri });
    else setKoAudio({ type: "file", uri });
    setRecordingLang(null);
    Alert.alert("저장됨", `${recordingLang === "english" ? "영어" : "한국어"} 음성이 저장됐습니다.`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  const canRecord = !!savedId;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNew ? "새 문장 추가" : "문장 편집",
          headerBackTitle: "닫기",
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* 카테고리 */}
        <View style={styles.section}>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 초기 난이도 */}
        <View style={styles.section}>
          <Text style={styles.label}>초기 난이도</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity
                key={d.value}
                style={[styles.chip, difficulty === d.value && styles.chipActive]}
                onPress={() => setDifficulty(d.value)}
              >
                <Text style={[styles.chipText, difficulty === d.value && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>연습 후 자동으로 업데이트됩니다</Text>
        </View>

        {/* 영어 원문 */}
        <View style={styles.section}>
          <Text style={styles.label}>
            영어 원문 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="영어 문장을 입력하세요"
            placeholderTextColor="#9CA3AF"
            value={englishText}
            onChangeText={setEnglishText}
          />
          {englishText.trim() ? (
            <View style={styles.audioRow}>
              <AudioPlayer
                source={
                  enAudio?.type === "file"
                    ? { type: "file", uri: enAudio.uri }
                    : { type: "tts", text: englishText, language: "en-US" }
                }
              />
              {canRecord && (
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={() => setRecordingLang(recordingLang === "english" ? null : "english")}
                >
                  <Text style={styles.recordBtnText}>
                    {enAudio?.type === "file" ? "🎙️ 재녹음" : "🎙️ 녹음"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {recordingLang === "english" && (
            <View style={styles.recorderBox}>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </View>
          )}
        </View>

        {/* 한국어 원문 */}
        <View style={styles.section}>
          <Text style={styles.label}>
            한국어 원문{" "}
            <Text style={styles.optional}>(선택 — 한→영 연습 활성화)</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="한국어 문장을 입력하세요"
            placeholderTextColor="#9CA3AF"
            value={koreanText}
            onChangeText={setKoreanText}
          />
          {koreanText.trim() ? (
            <View style={styles.audioRow}>
              <AudioPlayer
                source={
                  koAudio?.type === "file"
                    ? { type: "file", uri: koAudio.uri }
                    : { type: "tts", text: koreanText, language: "ko-KR" }
                }
              />
              {canRecord && (
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={() => setRecordingLang(recordingLang === "korean" ? null : "korean")}
                >
                  <Text style={styles.recordBtnText}>
                    {koAudio?.type === "file" ? "🎙️ 재녹음" : "🎙️ 녹음"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {recordingLang === "korean" && (
            <View style={styles.recorderBox}>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </View>
          )}
          {!canRecord && koreanText.trim() ? (
            <Text style={styles.hint}>저장 후 음성 녹음이 가능합니다</Text>
          ) : null}
        </View>

        {/* 모범 통역 */}
        <View style={styles.section}>
          <Text style={styles.label}>모범 한국어 통역 (영→한)</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="영→한 Step 5에 표시될 모범 통역문"
            placeholderTextColor="#9CA3AF"
            value={modelKorean}
            onChangeText={setModelKorean}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>모범 영어 통역 (한→영)</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="한→영 Step 5에 표시될 모범 통역문"
            placeholderTextColor="#9CA3AF"
            value={modelEnglish}
            onChangeText={setModelEnglish}
          />
        </View>

        {/* 태그 */}
        <View style={styles.section}>
          <Text style={styles.label}>
            태그 <Text style={styles.optional}>(쉼표로 구분)</Text>
          </Text>
          <TextInput
            style={[styles.textInput, styles.singleLine]}
            placeholder="예: idiom, passive, business"
            placeholderTextColor="#9CA3AF"
            value={tags}
            onChangeText={setTags}
          />
        </View>

        {/* 학습 메모 */}
        <View style={styles.section}>
          <Text style={styles.label}>학습 메모</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            multiline
            placeholder="주의할 표현, 자주 틀리는 부분 등..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{isNew ? "추가하기" : "저장하기"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  required: { color: "#EF4444" },
  optional: { fontWeight: "400", color: "#9CA3AF" },
  hint: { fontSize: 11, color: "#9CA3AF", marginTop: 6 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  chipActive: { borderColor: "#1A56DB", backgroundColor: "#EBF2FF" },
  chipText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#1A56DB", fontWeight: "700" },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  singleLine: { minHeight: 48 },
  notesInput: { minHeight: 100, backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  audioRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 },
  recordBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  recordBtnText: { fontSize: 13, color: "#374151" },
  recorderBox: {
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
