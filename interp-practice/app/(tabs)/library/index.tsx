import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getAllSentences, deleteSentence } from "../../../src/db/sentences";
import type { SentenceEntry, Category } from "../../../src/types";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "news",        label: "뉴스" },
  { key: "business",   label: "비즈니스" },
  { key: "conference", label: "회의" },
  { key: "daily",      label: "일상" },
];

const DIFFICULTIES = [
  { value: 1 as const, label: "★☆☆" },
  { value: 2 as const, label: "★★☆" },
  { value: 3 as const, label: "★★★" },
];

export default function LibraryIndex() {
  const router = useRouter();
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [filterDiff, setFilterDiff] = useState<1 | 2 | 3 | null>(null);
  const [filterCat, setFilterCat] = useState<Category | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

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

  const allTags = useMemo(() => {
    const set = new Set<string>();
    sentences.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [sentences]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sentences.filter((s) => {
      if (filterDiff && s.difficulty !== filterDiff) return false;
      if (filterCat && s.category !== filterCat) return false;
      if (filterTag && !s.tags.includes(filterTag)) return false;
      if (q) {
        const hit =
          s.englishText.toLowerCase().includes(q) ||
          (s.koreanText?.toLowerCase().includes(q) ?? false) ||
          (s.notes?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [sentences, query, filterDiff, filterCat, filterTag]);

  const isFiltered = !!query || filterDiff !== null || filterCat !== null || filterTag !== null;

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
      {/* 툴바 */}
      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {isFiltered ? `${filtered.length} / ${sentences.length}개` : `${sentences.length}개 문장`}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/library-edit/new")}>
          <Text style={styles.addBtnText}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 검색 */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="한국어 / 영어 통합 검색"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 필터 */}
      <View style={styles.filterArea}>
        {/* 난이도 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>난이도</Text>
          <TouchableOpacity
            style={[styles.chip, filterDiff === null && styles.chipActive]}
            onPress={() => setFilterDiff(null)}
          >
            <Text style={[styles.chipText, filterDiff === null && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d.value}
              style={[styles.chip, filterDiff === d.value && styles.chipActive]}
              onPress={() => setFilterDiff(filterDiff === d.value ? null : d.value)}
            >
              <Text style={[styles.chipText, filterDiff === d.value && styles.chipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 카테고리 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Text style={styles.filterLabel}>카테고리</Text>
          <TouchableOpacity
            style={[styles.chip, filterCat === null && styles.chipActive]}
            onPress={() => setFilterCat(null)}
          >
            <Text style={[styles.chipText, filterCat === null && styles.chipTextActive]}>전체</Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, filterCat === c.key && styles.chipActive]}
              onPress={() => setFilterCat(filterCat === c.key ? null : c.key)}
            >
              <Text style={[styles.chipText, filterCat === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 태그 */}
        {allTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Text style={styles.filterLabel}>태그</Text>
            <TouchableOpacity
              style={[styles.chip, filterTag === null && styles.chipActive]}
              onPress={() => setFilterTag(null)}
            >
              <Text style={[styles.chipText, filterTag === null && styles.chipTextActive]}>전체</Text>
            </TouchableOpacity>
            {allTags.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, filterTag === t && styles.chipActive]}
                onPress={() => setFilterTag(filterTag === t ? null : t)}
              >
                <Text style={[styles.chipText, filterTag === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      ) : sentences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>문장이 없습니다</Text>
          <Text style={styles.emptyDesc}>설정에서 구글 시트를 동기화하거나{"\n"}직접 추가해보세요.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>검색 결과 없음</Text>
          <Text style={styles.emptyDesc}>다른 검색어나 필터를 시도해보세요.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/library-edit/${item.id}`)}
              onLongPress={() => handleDelete(item.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badges}>
                  <Text style={styles.catBadge}>{item.category}</Text>
                  {item.koreanText && <Text style={styles.dirBadge}>양방향</Text>}
                  {item.tags.map((t) => (
                    <Text key={t} style={styles.tagBadge}>{t}</Text>
                  ))}
                </View>
                <Text style={styles.diffText}>
                  {"★".repeat(item.difficulty) + "☆".repeat(3 - item.difficulty)}
                </Text>
              </View>
              <Text style={styles.enText} numberOfLines={2}>{item.englishText}</Text>
              {item.koreanText && (
                <Text style={styles.koText} numberOfLines={1}>{item.koreanText}</Text>
              )}
              {item.notes && (
                <Text style={styles.notesPreview} numberOfLines={1}>📝 {item.notes}</Text>
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
  },
  addBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
  },
  clearBtn: { position: "absolute", right: 24, padding: 4 },
  clearBtnText: { fontSize: 13, color: "#9CA3AF" },
  filterArea: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 8,
    gap: 4,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    marginRight: 2,
    width: 40,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#1A56DB", borderColor: "#1A56DB" },
  chipText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4, flex: 1, marginRight: 8 },
  catBadge: {
    fontSize: 11, color: "#6B7280", backgroundColor: "#F3F4F6",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontWeight: "500",
  },
  dirBadge: {
    fontSize: 11, color: "#059669", backgroundColor: "#D1FAE5",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontWeight: "500",
  },
  tagBadge: {
    fontSize: 11, color: "#6366F1", backgroundColor: "#EEF2FF",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontWeight: "500",
  },
  diffText: { fontSize: 12, color: "#F59E0B" },
  enText: { fontSize: 15, color: "#111827", lineHeight: 22 },
  koText: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
  notesPreview: { fontSize: 12, color: "#92400E", lineHeight: 18 },
});
