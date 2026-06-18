import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { getAllSettings, setSetting } from "../../src/db/settings";
import type { UserSettings } from "../../src/types";
import { DEFAULT_SETTINGS } from "../../src/types";

const SPEEDS = [
  { value: 0.75 as const, label: "0.75x (느리게)" },
  { value: 1.0 as const, label: "1.0x (보통)" },
  { value: 1.25 as const, label: "1.25x (빠르게)" },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const s = await getAllSettings();
    setSettings(s);
  }

  async function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    await setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>연습 설정</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>원문 텍스트 표시</Text>
            <Text style={styles.rowDesc}>
              Step 1(듣기) 화면에서 원문 텍스트를 보여줍니다.{"\n"}
              OFF가 더 어렵고 효과적인 연습이 됩니다.
            </Text>
          </View>
          <Switch
            value={settings.showSourceTextDuringListen}
            onValueChange={(v) => updateSetting("showSourceTextDuringListen", v)}
            trackColor={{ true: "#1A56DB", false: "#E5E7EB" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>TTS 재생 속도</Text>
        {SPEEDS.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={styles.radioRow}
            onPress={() => updateSetting("playbackSpeed", s.value)}
          >
            <View
              style={[
                styles.radioCircle,
                settings.playbackSpeed === s.value && styles.radioCircleActive,
              ]}
            />
            <Text style={styles.radioLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>저장소</Text>
          <Text style={styles.infoValue}>기기 로컬 (SQLite)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>오디오 엔진</Text>
          <Text style={styles.infoValue}>expo-audio + expo-speech</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>음성 인식</Text>
          <Text style={styles.infoValue}>기기 내장 (무료)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 0, paddingBottom: 40 },
  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowDesc: { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  radioCircleActive: {
    borderColor: "#1A56DB",
    backgroundColor: "#1A56DB",
  },
  radioLabel: { fontSize: 15, color: "#374151" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: { fontSize: 14, color: "#6B7280" },
  infoValue: { fontSize: 14, color: "#374151", fontWeight: "500" },
});
