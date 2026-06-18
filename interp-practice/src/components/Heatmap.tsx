import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  data: Record<string, number>; // { "2026-06-18": 3, ... }
  weeks?: number;
}

const WEEK_DAYS = ["월", "", "수", "", "금", "", "일"];
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const CELL = 13;
const GAP = 3;

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

export function Heatmap({ data, weeks = 12 }: Props) {
  // Build grid: columns = weeks (oldest left), rows = day of week (Mon=0)
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6

  // Start from Monday of the week `weeks` ago
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

      if (month !== prevMonth && d === 0) {
        monthLabel = MONTH_NAMES[month];
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

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>적음</Text>
        {[0, 1, 2, 4].map((n) => (
          <View key={n} style={[styles.legendCell, { backgroundColor: getColor(n) }]} />
        ))}
        <Text style={styles.legendText}>많음</Text>
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
  dowSpacer: { width: 20 },
  monthCell: {
    width: CELL + GAP,
    alignItems: "flex-start",
  },
  monthText: { fontSize: 9, color: "#9CA3AF" },
  grid: { flexDirection: "row" },
  dowColumn: { width: 20, gap: GAP },
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
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: { fontSize: 9, color: "#9CA3AF" },
});
