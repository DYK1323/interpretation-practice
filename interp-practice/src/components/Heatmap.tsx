import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";

interface Props {
  data: Record<string, number>; // { "2026-06-18": 3, ... }
  weeks?: number;
}

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const CELL = 13;
const GAP = 3;
const DOW_WIDTH = 20;
// ScrollView content padding (16) + heatmap card padding (16) = 32 per side
const H_PADDING = 64;

function getColor(count: number): string {
  if (count === 0) return "#F3F4F6";
  if (count === 1) return "#BFDBFE";
  if (count <= 3) return "#60A5FA";
  return "#1A56DB";
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function Heatmap({ data }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const weeks = Math.max(4, Math.floor((screenWidth - H_PADDING - DOW_WIDTH) / (CELL + GAP)));

  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayDow - (weeks - 1) * 7);

  const columns: Array<{ monthLabel: string | null; days: Array<{ date: string; count: number }> }> = [];

  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const days: Array<{ date: string; count: number }> = [];
    let monthLabel: string | null = null;

    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      const dateStr = toLocalDateString(date);
      const month = date.getMonth();

      if (month !== prevMonth) {
        if (!monthLabel) monthLabel = MONTH_NAMES[month];
        prevMonth = month;
      }

      days.push({ date: dateStr, count: data[dateStr] ?? 0 });
    }

    columns.push({ monthLabel, days });
  }

  return (
    <View style={styles.container}>
      {/* Month labels row */}
      <View style={styles.monthRow}>
        <View style={styles.dowSpacer} />
        {columns.map((col, i) => (
          <View key={i} style={styles.monthCell}>
            {col.monthLabel ? (
              <Text style={styles.monthText}>{col.monthLabel}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {/* Day-of-week labels */}
        <View style={styles.dowColumn}>
          {WEEK_DAYS.map((label, i) => (
            <View key={i} style={styles.dowCell}>
              <Text style={styles.dowText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Week columns */}
        {columns.map((col, wi) => (
          <View key={wi} style={styles.weekColumn}>
            {col.days.map((day, di) => (
              <View
                key={di}
                style={[styles.cell, { backgroundColor: getColor(day.count) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  monthRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  dowSpacer: { width: DOW_WIDTH },
  monthCell: {
    width: CELL + GAP,
    paddingLeft: GAP,
  },
  monthText: { fontSize: 9, color: "#9CA3AF" },
  grid: { flexDirection: "row" },
  dowColumn: { width: DOW_WIDTH, gap: GAP },
  dowCell: {
    height: CELL,
    justifyContent: "center",
  },
  dowText: { fontSize: 9, color: "#9CA3AF" },
  weekColumn: { gap: GAP, marginLeft: GAP },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
});
