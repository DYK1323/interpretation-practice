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
import { getAllSentences, deleteSentence } from "../../../src/db/sentences";
import type { SentenceEntry } from "../../../src/types";

export default function LibraryIndex() {
  const router = useRouter();
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/library-edit/new")}
        >
          <Text style={styles.addBtnText}>+ 추가</Text>
        </TouchableOpacity>
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
            설정에서 구글 시트를 동기화하거나{"\n"}직접 추가해보세요.
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
              onPress={() => router.push(`/library-edit/${item.id}`)}
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
