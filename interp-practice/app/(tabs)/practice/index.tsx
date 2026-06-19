import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getDueWithSentences, getNewSentences } from "../../../src/db/progress";
import { getHeatmapData, getStats } from "../../../src/db/results";
import { useSessionStore } from "../../../src/features/session/useSessionStore";
import { Heatmap } from "../../../src/components/Heatmap";
import type { Direction, Category } from "../../../src/types";
import type { QueueItem } from "../../../src/features/session/useSessionStore";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "news",        label: "뉴스" },
  { key: "business",   label: "비즈니스" },
  { key: "conference", label: "회의/강연" },
  { key: "daily",      label: "일상" },
];

const NEW_SENTENCE_LIMIT = 10;

export default function PracticeHome() {
  const router = useRouter();
  const { startQueue } = useSessionStore();

  const [direction, setDirection] = useState<Direction>("en-ko");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ streak: 0, totalSentences: 0, todayCount: 0 });
  const [loading, setLoading] = useState(true);
  const [queueCache, setQueueCache] = useState<{
    due: QueueItem[];
    newItems: QueueItem[];
  }>({ due: [], newItems: [] });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [direction, selectedCategory])
  );

  async function loadData() {
    setLoading(true);
    const [due, newSentences, heatmap, statsData] = await Promise.all([
      getDueWithSentences(),
      getNewSentences(direction, selectedCategory, NEW_SENTENCE_LIMIT),
      getHeatmapData(84),
      getStats(),
    ]);

    const dueItems: QueueItem[] = due.map((d) => ({ sentence: d.sentence, direction: d.direction }));
    const newItems: QueueItem[] = newSentences.map((s) => ({ sentence: s, direction }));

    setDueCount(dueItems.length);
    setNewCount(newItems.length);
    setQueueCache({ due: dueItems, newItems });
    setHeatmapData(heatmap);
    setStats(statsData);
    setLoading(false);
  }

  // Reload new sentence count when filters change without full reload
  useFocusEffect(
    useCallback(() => {
      // Already handled by the main loadData above (it runs on direction/category change)
    }, [])
  );

  function handleStart() {
    const queue = [...queueCache.due, ...queueCache.newItems];
    if (queue.length === 0) {
      Alert.alert("학습할 문장 없음", "라이브러리에 문장을 추가하거나 복습 일정이 돌아올 때까지 기다려주세요.");
      return;
    }
    startQueue(queue);
    router.push("/practice/session");
  }

  const totalCount = dueCount + newCount;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", marginBottom: 4 }}>v4-swap</Text>
      {/* 통계 */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{stats.streak}</Text>
          <Text style={styles.statLabel}>연속</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>📚</Text>
          <Text style={styles.statValue}>{stats.totalSentences}</Text>
          <Text style={styles.statLabel}>문장</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>✅</Text>
          <Text style={styles.statValue}>{stats.todayCount}</Text>
          <Text style={styles.statLabel}>오늘</Text>
        </View>
      </View>

      {/* 오늘의 학습 큐 */}
      <View style={styles.queueCard}>
        <Text style={styles.queueTitle}>오늘의 학습</Text>

        <View style={styles.queueSummary}>
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeNum}>{dueCount}</Text>
            <Text style={styles.queueBadgeLabel}>복습</Text>
          </View>
          <Text style={styles.queuePlus}>+</Text>
          <View style={[styles.queueBadge, styles.queueBadgeNew]}>
            <Text style={[styles.queueBadgeNum, styles.queueBadgeNumNew]}>{newCount}</Text>
            <Text style={[styles.queueBadgeLabel, styles.queueBadgeLabelNew]}>새 문장</Text>
          </View>
          <Text style={styles.queueEquals}>=</Text>
          <Text style={styles.queueTotal}>{totalCount}문장</Text>
        </View>

        {/* 새 문장 필터 */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>새 문장 방향</Text>
          <View style={styles.chipRow}>
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
          <View style={styles.chipRow}>
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
          <Text style={styles.newLimit}>새 문장은 최대 {NEW_SENTENCE_LIMIT}개까지 추가됩니다</Text>
        </View>

        <TouchableOpacity
          style={[styles.startBtn, totalCount === 0 && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={totalCount === 0}
        >
          <Text style={styles.startBtnText}>
            {totalCount === 0 ? "학습할 문장 없음" : `시작하기  ${totalCount}문장 →`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 히트맵 */}
      <View style={styles.heatmapSection}>
        <Text style={styles.heatmapTitle}>최근 12주</Text>
        <Heatmap data={heatmapData} weeks={12} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 2 },
  statEmoji: { fontSize: 18 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280" },
  statDivider: { width: 1, height: 36, backgroundColor: "#E5E7EB" },
  heatmapSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  heatmapTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 10 },
  queueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 20,
  },
  queueTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  queueSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  queueBadge: {
    alignItems: "center",
    backgroundColor: "#EBF2FF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 2,
  },
  queueBadgeNew: { backgroundColor: "#F0FDF4" },
  queueBadgeNum: { fontSize: 22, fontWeight: "700", color: "#1A56DB" },
  queueBadgeNumNew: { color: "#059669" },
  queueBadgeLabel: { fontSize: 11, color: "#1A56DB", fontWeight: "500" },
  queueBadgeLabelNew: { color: "#059669" },
  queuePlus: { fontSize: 18, color: "#9CA3AF", fontWeight: "300" },
  queueEquals: { fontSize: 18, color: "#9CA3AF", fontWeight: "300" },
  queueTotal: { fontSize: 22, fontWeight: "700", color: "#111827" },
  filterSection: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  newLimit: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },
  startBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  startBtnDisabled: { backgroundColor: "#E5E7EB" },
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
});
