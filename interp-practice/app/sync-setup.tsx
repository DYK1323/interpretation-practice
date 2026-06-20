import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  ToastAndroid,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { getStringSetting, setStringSetting } from "../src/db/settings";
import { syncFromScript, exportToScript } from "../src/utils/scriptSync";
import { formatSyncTime } from "../src/utils/formatTime";

const SCRIPT_URL_KEY = "scriptSyncUrl";
const LAST_IMPORT_KEY = "scriptLastImportAt";
const LAST_EXPORT_KEY = "scriptLastExportAt";

const SCRIPT_CODE = `function doGet() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const csv = data.map(row => row.map(v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\\r\\n');
  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet().getActiveSheet();
  sheet.clearContents();
  const rows = Utilities.parseCsv(e.postData.contents);
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const STEPS = [
  "사용할 구글 스프레드시트를 엽니다.",
  "상단 메뉴: 확장 프로그램 → Apps Script",
  "편집기의 기존 코드를 모두 지우고 아래 스크립트를 붙여넣은 뒤 저장(Ctrl+S)합니다.",
  "오른쪽 위 배포 → 새 배포를 누릅니다.\n유형: 웹 앱\n다음 사용자로 실행: 나\n액세스 권한: 모든 사용자\n→ 배포 후 Google 계정 권한 허용",
  "표시된 웹 앱 URL을 복사해 아래에 붙여넣습니다.",
];

export default function SyncSetupScreen() {
  const router = useRouter();
  const [scriptUrl, setScriptUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastImportAt, setLastImportAt] = useState<number | null>(null);
  const [lastExportAt, setLastExportAt] = useState<number | null>(null);

  useEffect(() => {
    getStringSetting(SCRIPT_URL_KEY).then((v) => { if (v) setScriptUrl(v); });
    getStringSetting(LAST_IMPORT_KEY).then((v) => { if (v) setLastImportAt(Number(v)); });
    getStringSetting(LAST_EXPORT_KEY).then((v) => { if (v) setLastExportAt(Number(v)); });
  }, []);

  async function handleSaveUrl() {
    const url = scriptUrl.trim();
    if (!url) return;
    await setStringSetting(SCRIPT_URL_KEY, url);
    const msg = "URL이 저장됐습니다.";
    if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert("저장됨", msg);
  }

  async function handleImport() {
    const url = scriptUrl.trim();
    if (!url) { Alert.alert("URL을 먼저 입력하세요."); return; }
    setImporting(true);
    try {
      const { imported, failed } = await syncFromScript(url);
      const now = Date.now();
      await setStringSetting(LAST_IMPORT_KEY, String(now));
      setLastImportAt(now);
      Alert.alert("가져오기 완료", `${imported}개 문장 가져옴${failed > 0 ? `, ${failed}개 실패` : ""}`);
    } catch (e: any) {
      Alert.alert("가져오기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    const url = scriptUrl.trim();
    if (!url) { Alert.alert("URL을 먼저 입력하세요."); return; }
    setExporting(true);
    try {
      const count = await exportToScript(url);
      const now = Date.now();
      await setStringSetting(LAST_EXPORT_KEY, String(now));
      setLastExportAt(now);
      const msg = `${count}개 문장을 시트에 내보냈습니다.`;
      if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
      else Alert.alert("내보내기 완료", msg);
    } catch (e: any) {
      Alert.alert("내보내기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "양방향 동기화 설정",
          headerBackTitle: "설정",
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Google Apps Script를 통해 앱과 스프레드시트를 양방향으로 동기화합니다.
            최초 설정 후에는 버튼 하나로 가져오기·내보내기를 수동으로 실행할 수 있습니다.
          </Text>
        </View>

        {/* 설정 단계 */}
        <Text style={styles.sectionTitle}>설정 방법</Text>
        {STEPS.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        {/* 스크립트 코드 */}
        <View style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeLabel}>Apps Script 코드</Text>
            <TouchableOpacity
              onPress={() => Share.share({ message: SCRIPT_CODE })}
              style={styles.copyBtn}
            >
              <Text style={styles.copyBtnText}>공유 / 복사</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.codeBlock}
            value={SCRIPT_CODE}
            editable={false}
            multiline
            scrollEnabled={false}
            selectTextOnFocus
          />
        </View>

        {/* URL 입력 */}
        <Text style={styles.sectionTitle}>웹 앱 URL</Text>
        <TextInput
          style={styles.urlInput}
          placeholder="https://script.google.com/macros/s/.../exec"
          placeholderTextColor="#9CA3AF"
          value={scriptUrl}
          onChangeText={setScriptUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
          <Text style={styles.saveBtnText}>URL 저장</Text>
        </TouchableOpacity>

        {/* 동기화 버튼 */}
        <Text style={styles.sectionTitle}>동기화</Text>
        <TouchableOpacity
          style={[styles.actionBtn, importing && styles.actionBtnDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          {importing
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.actionBtnText}>시트 → 앱으로 가져오기</Text>
          }
        </TouchableOpacity>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>시트 내용을 앱 라이브러리로 가져옵니다. 기존 문장은 덮어씁니다.</Text>
          {lastImportAt && (
            <Text style={styles.lastSyncText}>마지막: {formatSyncTime(lastImportAt)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary, exporting && styles.actionBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator color="#1A56DB" size="small" />
            : <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>앱 → 시트로 내보내기</Text>
          }
        </TouchableOpacity>
        <View style={styles.hintRow}>
          <Text style={styles.hint}>앱의 모든 문장과 학습 진도를 시트에 씁니다. 시트 기존 내용은 덮어씁니다.</Text>
          {lastExportAt && (
            <Text style={styles.lastSyncText}>마지막: {formatSyncTime(lastExportAt)}</Text>
          )}
        </View>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20, paddingBottom: 48, gap: 0 },
  infoBox: {
    backgroundColor: "#EBF2FF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoText: { fontSize: 14, color: "#1E40AF", lineHeight: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginTop: 24,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1A56DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: { fontSize: 12, color: "#FFFFFF", fontWeight: "700" },
  stepText: { fontSize: 14, color: "#374151", lineHeight: 21, flex: 1 },
  codeCard: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  codeLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  copyBtn: {
    backgroundColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: { fontSize: 12, color: "#D1D5DB", fontWeight: "600" },
  codeBlock: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    color: "#D1FAE5",
    padding: 14,
    lineHeight: 18,
  },
  urlInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#111827",
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: "#6B7280",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  actionBtn: {
    backgroundColor: "#1A56DB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  actionBtnSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#1A56DB",
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  actionBtnTextSecondary: { color: "#1A56DB" },
  hintRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6, marginBottom: 4, gap: 8 },
  hint: { fontSize: 12, color: "#9CA3AF", flex: 1 },
  lastSyncText: { fontSize: 12, color: "#6B7280", flexShrink: 0 },
});
