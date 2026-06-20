import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getAllResults } from "../../src/db/results";
import { getSentencesByIds } from "../../src/db/sentences";
import { AudioPlayer } from "../../src/components/AudioPlayer";
import type { SessionResult, SentenceEntry } from "../../src/types";

interface ResultWithSentence {
  result: SessionResult;
  sentence: SentenceEntry | null;
}

export default function HistoryScreen() {
  const [items, setItems] = useState<ResultWithSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        const results = await getAllResults(100);
        const ids = [...new Set(results.map(r => r.sentenceId))];
        const sentenceMap = await getSentencesByIds(ids);
        if (cancelled) return;
        setItems(results.map(r => ({ result: r, sentence: sentenceMap[r.sentenceId] ?? null })));
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>아직 학습 기록이 없어요</Text>
        <Text style={styles.emptyDesc}>연습을 완료하면 여기에 기록됩니다.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.result.id}
      contentContainerStyle={styles.list}
      style={styles.container}
      renderItem={({ item: { result, sentence } }) => {
        const isExpanded = expanded === result.id;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setExpanded(isExpanded ? null : result.id)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badges}>
                <Text style={styles.dirBadge}>
                  {result.direction === "en-ko" ? "영→한" : "한→영"}
                </Text>
                {sentence && <Text style={styles.catBadge}>{sentence.category}</Text>}
              </View>
              <Text style={styles.dateText}>{formatDate(result.timestamp)}</Text>
            </View>

            <Text style={styles.originalText} numberOfLines={isExpanded ? undefined : 2}>
              {result.originalText}
            </Text>

            {isExpanded && (
              <View style={styles.expanded}>
                <View style={styles.divider} />
                {(result.interpRecordingUri || result.backInterpRecordingUri) ? (
                  <View style={styles.replayRow}>
                    {result.interpRecordingUri ? (
                      <View style={styles.replayItem}>
                        <Text style={styles.expandLabel}>통역 녹음</Text>
                        <AudioPlayer source={{ type: "file", uri: result.interpRecordingUri }} />
                      </View>
                    ) : null}
                    {result.backInterpRecordingUri ? (
                      <View style={styles.replayItem}>
                        <Text style={styles.expandLabel}>재통역 녹음</Text>
                        <AudioPlayer source={{ type: "file", uri: result.backInterpRecordingUri }} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.expandLabel}>내 재통역</Text>
                <Text style={styles.expandText}>
                  {result.backInterpText || "인식된 텍스트 없음"}
                </Text>
                {result.notes ? (
                  <>
                    <Text style={styles.expandLabel}>메모</Text>
                    <Text style={styles.noteText}>{result.notes}</Text>
                  </>
                ) : null}
              </View>
            )}

            <Text style={styles.expandHint}>{isExpanded ? "접기 ▲" : "펼치기 ▼"}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    backgroundColor: "#F9FAFB",
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptyDesc: { fontSize: 14, color: "#6B7280" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badges: { flexDirection: "row", gap: 6 },
  dirBadge: {
    fontSize: 11,
    color: "#1A56DB",
    backgroundColor: "#EBF2FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "600",
  },
  catBadge: {
    fontSize: 11,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateText: { fontSize: 12, color: "#9CA3AF" },
  originalText: { fontSize: 15, color: "#374151", lineHeight: 22 },
  expanded: { gap: 8 },
  replayRow: { flexDirection: "row", gap: 10 },
  replayItem: { flex: 1, gap: 4 },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
  expandLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase" },
  expandText: { fontSize: 14, color: "#374151", lineHeight: 21 },
  noteText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 21,
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  expandHint: { fontSize: 12, color: "#9CA3AF", textAlign: "right" },
});
