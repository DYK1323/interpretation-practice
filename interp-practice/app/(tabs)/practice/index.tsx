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
import { getDueWithSentences, getNewSentences, countNewStudiedToday, getTodaySentences } from "../../../src/db/progress";
import { getHeatmapData, getStats } from "../../../src/db/results";
import { getAllSettings } from "../../../src/db/settings";
import { useSessionStore } from "../../../src/features/session/useSessionStore";
import { Heatmap } from "../../../src/components/Heatmap";
import { CATEGORIES, DIRECTION_LABELS, FOREIGN_LANGUAGE_DIRECTIONS } from "../../../src/constants";
import type { Direction, Category, ForeignLanguage, UserSettings } from "../../../src/types/index";
import { DEFAULT_SETTINGS } from "../../../src/types/index";
import type { QueueItem } from "../../../src/features/session/useSessionStore";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticeHome() {
  const router = useRouter();
  const { startQueue, queue: storeQueue, pendingSplitUri } = useSessionStore();

  const [foreignLanguage, setForeignLanguage] = useState<ForeignLanguage>("en");
  const [direction, setDirection] = useState<Direction>("en-ko");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ streak: 0, totalSentences: 0, todayCount: 0 });
  const [practiceSettings, setPracticeSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [queueCache, setQueueCache] = useState<{
    retry: QueueItem[];
    due: QueueItem[];
    newItems: QueueItem[];
  }>({ retry: [], due: [], newItems: [] });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [direction, selectedCategory])
  );

  async function loadData() {
    setLoading(true);
    const s = await getAllSettings();
    setPracticeSettings(s);
    const fl = s.foreignLanguage;
    setForeignLanguage(fl);
    const dirs = FOREIGN_LANGUAGE_DIRECTIONS[fl];
    let activeDir: Direction = direction;
    if (!dirs.includes(activeDir)) {
      activeDir = dirs[0];
      setDirection(dirs[0]);
    }
    const newStudiedToday = await countNewStudiedToday();
    const remainingNew = Math.max(0, s.dailyNewLimit - newStudiedToday);
    const [due, newSentences, heatmap, statsData] = await Promise.all([
      getDueWithSentences(Date.now(), fl),
      getNewSentences(activeDir, selectedCategory, remainingNew),
      getHeatmapData(84),
      getStats(),
    ]);

    const retryItems: QueueItem[] = due.filter((d) => d.intervalDays === 0).map((d) => ({ sentence: d.sentence, direction: d.direction }));
    const dueItems: QueueItem[] = due.filter((d) => d.intervalDays > 0).map((d) => ({ sentence: d.sentence, direction: d.direction }));
    const newItems: QueueItem[] = newSentences.map((s) => ({ sentence: s, direction }));

    setRetryCount(retryItems.length);
    setDueCount(dueItems.length);
    setNewCount(newItems.length);
    setQueueCache({ retry: retryItems, due: dueItems, newItems });
    setHeatmapData(heatmap);
    setStats(statsData);
    setLoading(false);
  }

  function isSplitInProgress() {
    return practiceSettings.splitSessionMode
      && (storeQueue.some(item => item.interpRecordingUri) || !!pendingSplitUri);
  }

  function confirmNewStart(onConfirm: () => void) {
    if (isSplitInProgress()) {
      Alert.alert("진행 중인 세션", "분리 세션이 진행 중입니다.", [
        { text: "이어서 계속", onPress: () => router.push("/practice/session") },
        { text: "새로 시작", style: "destructive", onPress: onConfirm },
      ]);
    } else {
      onConfirm();
    }
  }

  function handleStart() {
    let queue = [...queueCache.retry, ...queueCache.due, ...queueCache.newItems];
    if (practiceSettings.shuffleSentences) queue = shuffle(queue);
    confirmNewStart(() => {
      startQueue(queue);
      router.push("/practice/session");
    });
  }

  async function handleExtraNew() {
    const extra = await getNewSentences(direction, selectedCategory, 10);
    if (extra.length === 0) {
      Alert.alert("새 문장 없음", "라이브러리에 학습할 새 문장이 없습니다.");
      return;
    }
    let queue: QueueItem[] = extra.map((s) => ({ sentence: s, direction }));
    if (practiceSettings.shuffleSentences) queue = shuffle(queue);
    confirmNewStart(() => {
      startQueue(queue);
      router.push("/practice/session");
    });
  }

  async function handleReviewToday() {
    const today = await getTodaySentences(foreignLanguage);
    if (today.length === 0) {
      Alert.alert("오늘 학습한 문장 없음", "오늘 학습한 문장이 없습니다.");
      return;
    }
    let queue: QueueItem[] = today.map((d) => ({ sentence: d.sentence, direction: d.direction }));
    if (practiceSettings.shuffleSentences) queue = shuffle(queue);
    confirmNewStart(() => {
      startQueue(queue);
      router.push("/practice/session");
    });
  }

  const totalCount = retryCount + dueCount + newCount;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <View style={styles.queueTitleRow}>
          <Text style={styles.queueTitle}>오늘의 학습</Text>
          <View style={styles.badgeRow}>
            {retryCount > 0 && (
              <View style={styles.retryBadge}>
                <Text style={styles.retryBadgeText}>재도전 {retryCount}</Text>
              </View>
            )}
            {dueCount > 0 && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>복습 {dueCount}</Text>
              </View>
            )}
            {newCount > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>새 문장 {newCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 새 문장 필터 */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>새 문장 방향</Text>
          <View style={styles.chipRow}>
            {FOREIGN_LANGUAGE_DIRECTIONS[foreignLanguage].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, direction === d && styles.chipActive]}
                onPress={() => setDirection(d)}
              >
                <Text style={[styles.chipText, direction === d && styles.chipTextActive]}>
                  {DIRECTION_LABELS[d]}
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
          <Text style={styles.newLimit}>새 문장은 최대 {practiceSettings.dailyNewLimit}개까지 추가됩니다</Text>
        </View>

        {totalCount > 0 ? (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startBtnText}>시작하기  {totalCount}문장 →</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.doneSection}>
            <Text style={styles.doneText}>오늘 학습을 완료했어요! 🎉</Text>
            <TouchableOpacity style={styles.extraBtn} onPress={handleExtraNew}>
              <Text style={styles.extraBtnText}>새 문장 더 학습하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.extraBtn, styles.extraBtnSecondary]} onPress={handleReviewToday}>
              <Text style={[styles.extraBtnText, styles.extraBtnTextSecondary]}>오늘 학습한 문장 다시 연습</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 히트맵 */}
      <View style={styles.heatmapSection}>
        <Text style={styles.heatmapTitle}>학습 기록</Text>
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
    marginBottom: 16,
  },
  queueTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  queueTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  badgeRow: { flexDirection: "row", gap: 6 },
  retryBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  retryBadgeText: { fontSize: 12, fontWeight: "700", color: "#D97706" },
  dueBadge: {
    backgroundColor: "#EBF2FF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dueBadgeText: { fontSize: 12, fontWeight: "700", color: "#1A56DB" },
  newBadge: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: { fontSize: 12, fontWeight: "700", color: "#059669" },
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
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  doneSection: { gap: 10, alignItems: "center" },
  doneText: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  extraBtn: {
    width: "100%",
    backgroundColor: "#1A56DB",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  extraBtnSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#1A56DB",
  },
  extraBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  extraBtnTextSecondary: { color: "#1A56DB" },
});
