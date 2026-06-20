import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Direction } from "../types/index";
import { LANG_LABEL } from "../constants";

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
  const [src, tgt] = direction.split("-");
  const originalLabel   = `원문 (${LANG_LABEL[src]})`;
  const modelLabel      = `통역 예시 (${LANG_LABEL[tgt]})`;
  const backInterpLabel = `내 재통역 (${LANG_LABEL[src]})`;

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  block: {
    gap: 8,
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
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    padding: 16,
  },
  modelText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#0369A1",
  },
});
