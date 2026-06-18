import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getDueForReview } from "../../../src/db/progress";
import { getSentenceById } from "../../../src/db/sentences";
import { getAllSentences } from "../../../src/db/sentences";
import { useSessionStore } from "../../../src/features/session/useSessionStore";
import type { SentenceEntry, Direction, SentenceProgress, Category } from "../../../src/types";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "news", label: "뉴스" },
  { key: "business", label: "비즈니스" },
  { key: "conference", label: "회의/강연" },
  { key: "daily", label: "일상" },
];

const DIFFICULTIES = [
  { key: 1 as const, label: "★☆☆" },
  { key: 2 as const, label: "★★☆" },
  { key: 3 as const, label: "★★★" },
];

export default function PracticeHome() {
  const router = useRouter();
  const { startSession } = useSessionStore();

  const [direction, setDirection] = useState<Direction>("en-ko");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<1 | 2 | 3 | null>(null);
  const [dueItems, setDueItems] = useState<Array<{ progress: SentenceProgress; sentence: SentenceEntry | null }>>([]);
  const [allSentences, setAllSentences] = useState<SentenceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [due, sentences] = await Promise.all([getDueForReview(), getAllSentences()]);
    const dueWithSentences = await Promise.all(
      due.map(async (p) => ({ progress: p, sentence: await getSentenceById(p.sentenceId) }))
    );
    setDueItems(dueWithSentences.filter((d) => d.sentence !== null));
    setAllSentences(sentences);
    setLoading(false);
  }

  const filteredSentences = allSentences.filter((s) => {
    if (direction === "ko-en" && !s.koreanText) return false;
    if (selectedCategory && s.category !== selectedCategory) return false;
    if (selectedDifficulty && s.difficulty !== selectedDifficulty) return false;
    return true;
  });

  function handleStartSession(sentence: SentenceEntry, dir: Direction = direction) {
    startSession(sentence, dir);
    router.push("/practice/session");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {dueItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘의 복습 ({dueItems.length})</Text>
          {dueItems.slice(0, 5).map(({ progress, sentence }) =>
            sentence ? (
              <TouchableOpacity
                key={`${progress.sentenceId}-${progress.direction}`}
                style={styles.reviewCard}
                onPress={() => handleStartSession(sentence, progress.direction)}
              >
                <View style={styles.reviewCardLeft}>
                  <Text style={styles.directionBadge}>
                    {progress.direction === "en-ko" ? "영→한" : "한→영"}
                  </Text>
                  <Text style={styles.reviewText} numberOfLines={2}>
                    {progress.direction === "en-ko" ? sentence.englishText : sentence.koreanText}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ) : null
          )}
          {dueItems.length > 5 && (
            <Text style={styles.moreText}>+{dueItems.length - 5}개 더</Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>새 문장 연습</Text>

        <Text style={styles.filterLabel}>방향</Text>
        <View style={styles.row}>
          {(["en-ko", "ko-en"] as Direction[]).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, direction === d && styles.chipActive]}
              onPress={() => setDirection(d)}
            >
              <Text style={[styles.chipText, direction === d && styles.chipTextActive]}>
                {d === "en-ko" ? "영→한" : "한→영"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>카테고리</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, selectedCategory === c.key && styles.chipActive]}
              onPress={() => setSelectedCategory(c.key)}
            >
              <Text style={[styles.chipText, selectedCategory === c.key && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>난이도</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, !selectedDifficulty && styles.chipActive]}
            onPress={() => setSelectedDifficulty(null)}
          >
            <Text style={[styles.chipText, !selectedDifficulty && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d.key}
              style={[styles.chip, selectedDifficulty === d.key && styles.chipActive]}
              onPress={() => setSelectedDifficulty(d.key)}
            >
              <Text style={[styles.chipText, selectedDifficulty === d.key && styles.chipTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredSentences.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {allSentences.length === 0
                ? "라이브러리에 문장을 추가해주세요."
                : "해당 조건의 문장이 없습니다."}
            </Text>
          </View>
        ) : (
          filteredSentences.map((sentence) => (
            <TouchableOpacity
              key={sentence.id}
              style={styles.sentenceCard}
              onPress={() => handleStartSession(sentence)}
            >
              <View style={styles.sentenceCardMeta}>
                <Text style={styles.categoryBadge}>{sentence.category}</Text>
                <Text style={styles.difficultyText}>
                  {"★".repeat(sentence.difficulty) + "☆".repeat(3 - sentence.difficulty)}
                </Text>
              </View>
              <Text style={styles.sentenceText} numberOfLines={2}>
                {direction === "en-ko" ? sentence.englishText : sentence.koreanText}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 0, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF2FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  reviewCardLeft: { flex: 1, gap: 4 },
  directionBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A56DB",
    backgroundColor: "#DBEAFE",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reviewText: { fontSize: 14, color: "#1E40AF", lineHeight: 20 },
  chevron: { fontSize: 20, color: "#1A56DB" },
  moreText: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4 },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    marginTop: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#1A56DB", borderColor: "#1A56DB" },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#FFFFFF" },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },
  sentenceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  sentenceCardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryBadge: {
    fontSize: 11,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
  },
  difficultyText: { fontSize: 12, color: "#F59E0B" },
  sentenceText: { fontSize: 15, color: "#374151", lineHeight: 22 },
});
