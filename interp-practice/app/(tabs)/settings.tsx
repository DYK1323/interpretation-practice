import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from "react-native";
import { getAllSettings, setSetting, getStringSetting, setStringSetting } from "../../src/db/settings";
import { syncFromSheetUrl } from "../../src/utils/csvImport";
import { exportCSV } from "../../src/utils/csvExport";
import type { UserSettings } from "../../src/types";
import { DEFAULT_SETTINGS } from "../../src/types";

const SPEEDS = [
  { value: 0.75 as const, label: "0.75x (느리게)" },
  { value: 1.0 as const, label: "1.0x (보통)" },
  { value: 1.25 as const, label: "1.25x (빠르게)" },
];

const PRESET_LIMITS = [10, 20, 30];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const limitInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const s = await getAllSettings();
    setSettings(s);
    const url = await getStringSetting("sheetSyncUrl");
    if (url) setSheetUrl(url);
  }

  async function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    await setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleCustomLimit() {
    const n = parseInt(limitInput, 10);
    if (!n || n < 1 || n > 999) {
      Alert.alert("올바른 숫자를 입력하세요 (1~999)");
      return;
    }
    updateSetting("dailyNewLimit", n);
    setLimitModalVisible(false);
    setLimitInput("");
  }

  async function handleSync() {
    const url = sheetUrl.trim();
    if (!url) {
      Alert.alert("URL 필요", "구글 시트 공유 링크를 입력하세요.");
      return;
    }
    await setStringSetting("sheetSyncUrl", url);
    setSyncing(true);
    try {
      const { imported, failed } = await syncFromSheetUrl(url);
      Alert.alert(
        "동기화 완료",
        `${imported}개 문장 가져옴${failed > 0 ? `, ${failed}개 실패` : ""}`
      );
    } catch (e: any) {
      Alert.alert("동기화 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const count = await exportCSV();
      if (count === 0) {
        Alert.alert("내보낼 문장 없음", "라이브러리에 문장을 추가하세요.");
      } else if (Platform.OS === "android") {
        ToastAndroid.show(`${count}개 문장 내보내기 완료`, ToastAndroid.SHORT);
      }
    } catch (e: any) {
      Alert.alert("내보내기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 구글 시트 동기화 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>구글 시트 동기화</Text>
        <Text style={styles.desc}>
          시트를 "링크 있는 모든 사용자 보기"로 공유한 뒤 링크를 붙여넣으세요.
        </Text>
        <TextInput
          style={styles.urlInput}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          placeholderTextColor="#9CA3AF"
          value={sheetUrl}
          onChangeText={setSheetUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.actionBtn, syncing && styles.actionBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.actionBtnText}>시트에서 문장 가져오기</Text>
          }
        </TouchableOpacity>
      </View>

      {/* CSV 내보내기 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>데이터 내보내기</Text>
        <Text style={styles.desc}>
          앱의 모든 문장을 CSV로 내보냅니다. 구글 드라이브에 저장하거나 백업으로 보관하세요.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary, exporting && styles.actionBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#1A56DB" />
            : <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>CSV 내보내기</Text>
          }
        </TouchableOpacity>
        <Text style={styles.hint}>공유 창에서 구글 드라이브를 선택하세요</Text>
      </View>

      {/* 연습 설정 */}
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

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>문장 순서 섞기</Text>
            <Text style={styles.rowDesc}>ON이면 매번 무작위 순서로 학습합니다.</Text>
          </View>
          <Switch
            value={settings.shuffleSentences}
            onValueChange={(v) => updateSetting("shuffleSentences", v)}
            trackColor={{ true: "#1A56DB", false: "#E5E7EB" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.limitSection}>
          <Text style={styles.rowTitle}>하루 새 문장 수</Text>
          <Text style={styles.rowDesc}>복습 문장 외에 추가할 새 문장의 최대 개수입니다.</Text>
          <View style={styles.chipRow}>
            {PRESET_LIMITS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, settings.dailyNewLimit === n && styles.chipActive]}
                onPress={() => updateSetting("dailyNewLimit", n)}
              >
                <Text style={[styles.chipText, settings.dailyNewLimit === n && styles.chipTextActive]}>
                  {n}개
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.chip,
                !PRESET_LIMITS.includes(settings.dailyNewLimit) && styles.chipActive,
              ]}
              onPress={() => {
                setLimitInput(String(settings.dailyNewLimit));
                setLimitModalVisible(true);
                setTimeout(() => limitInputRef.current?.focus(), 100);
              }}
            >
              <Text style={[
                styles.chipText,
                !PRESET_LIMITS.includes(settings.dailyNewLimit) && styles.chipTextActive,
              ]}>
                {PRESET_LIMITS.includes(settings.dailyNewLimit) ? "기타" : `${settings.dailyNewLimit}개`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* TTS 속도 */}
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

      {/* 정보 */}
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

      <Modal
        visible={limitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLimitModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>하루 새 문장 수</Text>
            <TextInput
              ref={limitInputRef}
              style={styles.modalInput}
              keyboardType="number-pad"
              value={limitInput}
              onChangeText={setLimitInput}
              placeholder="개수 입력"
              placeholderTextColor="#9CA3AF"
              onSubmitEditing={handleCustomLimit}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setLimitModalVisible(false); setLimitInput(""); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCustomLimit}>
                <Text style={styles.modalConfirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    gap: 12,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  desc: { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  hint: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  urlInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  actionBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#1A56DB",
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  actionBtnTextSecondary: { color: "#1A56DB" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowDesc: { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  limitSection: { gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
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
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: 280,
    gap: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 20,
    textAlign: "center",
    color: "#111827",
  },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1A56DB",
    alignItems: "center",
  },
  modalConfirmText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
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
