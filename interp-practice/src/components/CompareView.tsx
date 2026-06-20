import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { Direction } from "../types";

interface Props {
  originalText: string;
  backInterpText: string;
  direction: Direction;
  modelInterpretation?: string;
}

export function CompareView({
  originalText,
  backInterpText,
  direction,
  modelInterpretation,
}: Props) {
  const originalLabel = direction === "en-ko" ? "원문 (영어)" : "원문 (한국어)";
  const modelLabel = direction === "en-ko" ? "모범 한국어 통역" : "모범 영어 통역";
  const backInterpLabel = direction === "en-ko" ? "내 재통역 (영어)" : "내 재통역 (한국어)";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.block}>
        <Text style={styles.blockLabel}>{originalLabel}</Text>
        <Text style={styles.originalText}>{originalText}</Text>
      </View>

      {modelInterpretation && (
        <>
          <View style={styles.divider} />
          <View style={styles.modelBlock}>
            <Text style={styles.blockLabel}>{modelLabel}</Text>
            <Text style={styles.modelText}>{modelInterpretation}</Text>
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{backInterpLabel}</Text>
        <Text style={[styles.interpText, !backInterpText && styles.emptyText]}>
          {backInterpText || "인식된 텍스트 없음"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 0,
  },
  block: {
    gap: 8,
    paddingVertical: 16,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  originalText: {
    fontSize: 18,
    lineHeight: 28,
    color: "#111827",
    fontWeight: "500",
  },
  interpText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#374151",
  },
  emptyText: {
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  modelBlock: {
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modelText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#0369A1",
  },
});
