import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getAllSentences, deleteSentence } from "../../../src/db/sentences";
import { importCSV } from "../../../src/utils/csvImport";
import type { SentenceEntry } from "../../../src/types";

export default function LibraryIndex() {
  const router = useRouter();
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    const data = await getAllSentences();
    setSentences(data);
    setLoading(false);
  }

  async function handleDownloadTemplate() {
    const template = [
      "id,category,difficulty,englishText,koreanText,modelKorean,modelEnglish,tags",
      'news_001,news,2,"The talks collapsed without agreement.","협상이 합의 없이 결렬됐다.","협상이 합의 없이 결렬됐습니다.","The talks ended without reaching an agreement.",idiom',
      'daily_001,daily,1,"How was your day?","오늘 어땠어?","오늘 하루 어떠셨나요?","How was your day?",',
    ].join("\n");

    const file = new File(Paths.cache, "template.csv");
    file.write(template);
    await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "CSV 양식 저장" });
  }

  async function handleImport() {
    setImporting(true);
    try {
      const { imported, failed } = await importCSV();
      await load();
      Alert.alert(
        "가져오기 완료",
        `${imported}개 문장을 가져왔습니다.${failed > 0 ? ` (${failed}개 실패)` : ""}`
      );
    } catch (e) {
      Alert.alert("오류", "CSV 파일을 처리하는 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  function handleDelete(id: string) {
    Alert.alert("문장 삭제", "이 문장을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deleteSentence(id);
          setSentences((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{sentences.length}개 문장</Text>
        <View style={styles.toolbarButtons}>
          <TouchableOpacity style={styles.templateBtn} onPress={handleDownloadTemplate}>
            <Text style={styles.templateBtnText}>양식 공유</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBtn, importing && styles.importBtnDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.importBtnText}>CSV 가져오기</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/library/new")}
          >
            <Text style={styles.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      ) : sentences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>문장이 없습니다</Text>
          <Text style={styles.emptyDesc}>
            CSV 파일로 문장을 가져오거나{"\n"}직접 추가해보세요.
          </Text>
          <Text style={styles.csvFormat}>
            CSV 컬럼 순서:{"\n"}
            id, category, difficulty, englishText, koreanText,{"\n"}
            englishAudioType, koreanAudioType, modelKorean, modelEnglish, tags
          </Text>
        </View>
      ) : (
        <FlatList
          data={sentences}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/library/${item.id}`)}
              onLongPress={() => handleDelete(item.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badges}>
                  <Text style={styles.catBadge}>{item.category}</Text>
                  {item.koreanText && (
                    <Text style={styles.dirBadge}>양방향</Text>
                  )}
                </View>
                <Text style={styles.diffText}>
                  {"★".repeat(item.difficulty) + "☆".repeat(3 - item.difficulty)}
                </Text>
              </View>
              <Text style={styles.enText} numberOfLines={2}>
                {item.englishText}
              </Text>
              {item.koreanText && (
                <Text style={styles.koText} numberOfLines={1}>
                  {item.koreanText}
                </Text>
              )}
              {item.notes && (
                <Text style={styles.notesPreview} numberOfLines={1}>
                  📝 {item.notes}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  count: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  toolbarButtons: { flexDirection: "row", gap: 8 },
  templateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A56DB",
  },
  templateBtnText: { color: "#1A56DB", fontSize: 13, fontWeight: "600" },
  importBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  importBtnDisabled: { opacity: 0.6 },
  importBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  addBtn: {
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptyDesc: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
  csvFormat: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badges: { flexDirection: "row", gap: 6 },
  catBadge: {
    fontSize: 11,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
  },
  dirBadge: {
    fontSize: 11,
    color: "#059669",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
  },
  diffText: { fontSize: 12, color: "#F59E0B" },
  enText: { fontSize: 15, color: "#111827", lineHeight: 22 },
  koText: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
  notesPreview: { fontSize: 12, color: "#92400E", lineHeight: 18 },
});
