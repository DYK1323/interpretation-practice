import React, { useEffect, useRef, useState } from "react";
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
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { getSentenceById, upsertSentence, updateSentenceAudio } from "../../src/db/sentences";
import { getAllSettings } from "../../src/db/settings";
import { RecordButton } from "../../src/components/RecordButton";
import { AudioPlayer } from "../../src/components/AudioPlayer";
import { CATEGORIES } from "../../src/constants";
import type { SentenceEntry, Category, ForeignLanguage } from "../../src/types/index";

const DIFFICULTIES: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "★☆☆" },
  { value: 2, label: "★★☆" },
  { value: 3, label: "★★★" },
];

function makeNewId() {
  return `custom_${Date.now()}`;
}

type RecordingLang = "english" | "korean" | "japanese" | "chinese";

export default function SentenceEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const savingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [recordingLang, setRecordingLang] = useState<RecordingLang | null>(null);

  const [foreignLanguage, setForeignLanguage] = useState<ForeignLanguage>("en");
  const [englishText, setEnglishText] = useState("");
  const [koreanText, setKoreanText] = useState("");
  const [japaneseText, setJapaneseText] = useState("");
  const [chineseText, setChineseText] = useState("");
  const [category, setCategory] = useState<Category>("daily");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [tags, setTags] = useState("");
  const [modelKorean, setModelKorean] = useState("");
  const [modelEnglish, setModelEnglish] = useState("");
  const [modelJapanese, setModelJapanese] = useState("");
  const [modelChinese, setModelChinese] = useState("");
  const [notes, setNotes] = useState("");
  const [enAudio, setEnAudio] = useState<SentenceEntry["englishAudio"]>({ type: "tts" });
  const [koAudio, setKoAudio] = useState<SentenceEntry["koreanAudio"]>({ type: "tts" });
  const [jaAudio, setJaAudio] = useState<SentenceEntry["japaneseAudio"]>({ type: "tts" });
  const [zhAudio, setZhAudio] = useState<SentenceEntry["chineseAudio"]>({ type: "tts" });

  useEffect(() => {
    if (!isNew && id) loadSentence(id);
    else loadSettingsForLanguage();
  }, [id]);

  async function loadSettingsForLanguage() {
    const s = await getAllSettings();
    setForeignLanguage(s.foreignLanguage);
    setLoading(false);
  }

  async function loadSentence(sentenceId: string) {
    setLoading(true);
    const s = await getSentenceById(sentenceId);
    if (s) {
      setForeignLanguage(s.foreignLanguage ?? "en");
      setEnglishText(s.englishText);
      setKoreanText(s.koreanText ?? "");
      setJapaneseText(s.japaneseText ?? "");
      setChineseText(s.chineseText ?? "");
      setCategory(s.category);
      setDifficulty(s.difficulty);
      setTags(s.tags.join(", "));
      setModelKorean(s.modelKorean ?? "");
      setModelEnglish(s.modelEnglish ?? "");
      setModelJapanese(s.modelJapanese ?? "");
      setModelChinese(s.modelChinese ?? "");
      setNotes(s.notes ?? "");
      setEnAudio(s.englishAudio ?? { type: "tts" });
      setKoAudio(s.koreanAudio ?? { type: "tts" });
      setJaAudio(s.japaneseAudio ?? { type: "tts" });
      setZhAudio(s.chineseAudio ?? { type: "tts" });
    }
    setLoading(false);
  }

  function getPrimaryConfig() {
    switch (foreignLanguage) {
      case "ja": return {
        lang: "japanese" as RecordingLang,
        label: "일본어 원문",
        placeholder: "일본어 문장을 입력하세요",
        ttsLang: "ja-JP",
        text: japaneseText,
        setText: setJapaneseText,
        audio: jaAudio,
        koDesc: "한→일 연습 활성화",
        modelKoDir: "일→한 연습 전용",
        modelForeignLabel: "통역 예시 — 일본어",
        modelForeignDir: "한→일 연습 전용",
        modelForeignText: modelJapanese,
        setModelForeignText: setModelJapanese,
      };
      case "zh": return {
        lang: "chinese" as RecordingLang,
        label: "중국어 원문",
        placeholder: "중국어 문장을 입력하세요",
        ttsLang: "zh-CN",
        text: chineseText,
        setText: setChineseText,
        audio: zhAudio,
        koDesc: "한→중 연습 활성화",
        modelKoDir: "중→한 연습 전용",
        modelForeignLabel: "통역 예시 — 중국어",
        modelForeignDir: "한→중 연습 전용",
        modelForeignText: modelChinese,
        setModelForeignText: setModelChinese,
      };
      default: return {
        lang: "english" as RecordingLang,
        label: "영어 원문",
        placeholder: "영어 문장을 입력하세요",
        ttsLang: "en-US",
        text: englishText,
        setText: setEnglishText,
        audio: enAudio,
        koDesc: "한→영 연습 활성화",
        modelKoDir: "영→한 연습 전용",
        modelForeignLabel: "통역 예시 — 영어",
        modelForeignDir: "한→영 연습 전용",
        modelForeignText: modelEnglish,
        setModelForeignText: setModelEnglish,
      };
    }
  }

  async function handleSave() {
    if (savingRef.current) return;
    const cfg = getPrimaryConfig();
    if (!cfg.text.trim()) {
      Alert.alert("오류", `${cfg.label}을 입력해주세요.`);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const sentenceId = savedId ?? makeNewId();
    const entry: SentenceEntry = {
      id: sentenceId,
      category,
      difficulty,
      foreignLanguage,
      englishText: foreignLanguage === "en" ? englishText.trim() : "",
      koreanText: koreanText.trim() || undefined,
      englishAudio: foreignLanguage === "en" ? enAudio : { type: "tts" },
      koreanAudio: koAudio,
      japaneseText: foreignLanguage === "ja" ? (japaneseText.trim() || undefined) : undefined,
      japaneseAudio: foreignLanguage === "ja" ? jaAudio : undefined,
      chineseText: foreignLanguage === "zh" ? (chineseText.trim() || undefined) : undefined,
      chineseAudio: foreignLanguage === "zh" ? zhAudio : undefined,
      modelKorean: modelKorean.trim() || undefined,
      modelEnglish: foreignLanguage === "en" ? (modelEnglish.trim() || undefined) : undefined,
      modelJapanese: foreignLanguage === "ja" ? (modelJapanese.trim() || undefined) : undefined,
      modelChinese: foreignLanguage === "zh" ? (modelChinese.trim() || undefined) : undefined,
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
      savingRef.current = false;
    }
  }

  async function handleRecordingComplete(uri: string) {
    if (!recordingLang || !savedId) return;
    const existingAudio =
      recordingLang === "english" ? enAudio :
      recordingLang === "korean" ? koAudio :
      recordingLang === "japanese" ? jaAudio :
      zhAudio;
    const langLabel =
      recordingLang === "english" ? "영어" :
      recordingLang === "korean" ? "한국어" :
      recordingLang === "japanese" ? "일본어" : "중국어";

    const doSave = async () => {
      await updateSentenceAudio(savedId, recordingLang, uri);
      if (recordingLang === "english") setEnAudio({ type: "file", uri });
      else if (recordingLang === "korean") setKoAudio({ type: "file", uri });
      else if (recordingLang === "japanese") setJaAudio({ type: "file", uri });
      else setZhAudio({ type: "file", uri });
      setRecordingLang(null);
      Alert.alert("저장됨", `${langLabel} 음성이 저장됐습니다.`);
    };

    if (existingAudio?.type === "file") {
      Alert.alert(
        "기존 음성 덮어쓰기",
        "기존 녹음을 새 녹음으로 교체할까요?",
        [
          { text: "취소", style: "cancel", onPress: () => setRecordingLang(null) },
          {
            text: "교체",
            style: "destructive",
            onPress: async () => {
              try { await FileSystem.deleteAsync(existingAudio.uri, { idempotent: true }); } catch {}
              await doSave();
            },
          },
        ]
      );
    } else {
      await doSave();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  const canRecord = !!savedId;
  const cfg = getPrimaryConfig();

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

        <View style={styles.section}>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, category === c.key && styles.chipActive]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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

        {/* Primary language (English / Japanese / Chinese based on foreignLanguage) */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {cfg.label} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder={cfg.placeholder}
            placeholderTextColor="#9CA3AF"
            value={cfg.text}
            onChangeText={cfg.setText}
          />
          {cfg.text.trim() ? (
            <View style={styles.audioRow}>
              <AudioPlayer
                source={
                  cfg.audio?.type === "file"
                    ? { type: "file", uri: (cfg.audio as { type: "file"; uri: string }).uri }
                    : { type: "tts", text: cfg.text, language: cfg.ttsLang }
                }
              />
              {canRecord && (
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={() => setRecordingLang(recordingLang === cfg.lang ? null : cfg.lang)}
                >
                  <Ionicons name="mic-outline" size={16} color="#374151" />
                  <Text style={styles.recordBtnText}>
                    {cfg.audio?.type === "file" ? "재녹음" : "녹음"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {recordingLang === cfg.lang && (
            <View style={styles.recorderBox}>
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            </View>
          )}
        </View>

        {/* Korean (always secondary) */}
        <View style={styles.section}>
          <Text style={styles.label}>
            한국어 원문{" "}
            <Text style={styles.optional}>(선택 — {cfg.koDesc})</Text>
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
                  <Ionicons name="mic-outline" size={16} color="#374151" />
                  <Text style={styles.recordBtnText}>
                    {koAudio?.type === "file" ? "재녹음" : "녹음"}
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

        {/* Model interp — Korean (외→한 direction) */}
        <View style={styles.section}>
          <Text style={styles.label}>
            통역 예시 — 한국어{" "}
            <Text style={styles.optional}>({cfg.modelKoDir})</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="비워두면 한국어 원문이 표시됨. 다르게 통역하고 싶을 때만 입력."
            placeholderTextColor="#9CA3AF"
            value={modelKorean}
            onChangeText={setModelKorean}
          />
        </View>

        {/* Model interp — Foreign language (한→외 direction) */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {cfg.modelForeignLabel}{" "}
            <Text style={styles.optional}>({cfg.modelForeignDir})</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder={`비워두면 ${cfg.label}이 표시됨. 다르게 통역하고 싶을 때만 입력.`}
            placeholderTextColor="#9CA3AF"
            value={cfg.modelForeignText}
            onChangeText={cfg.setModelForeignText}
          />
        </View>

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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
