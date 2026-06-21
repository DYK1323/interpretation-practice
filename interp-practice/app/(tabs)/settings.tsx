import React, { useCallback, useRef, useState } from "react";
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
import * as Updates from "expo-updates";
import { useRouter, useFocusEffect } from "expo-router";
import { getAllSettings, setSetting, getStringSetting, setStringSetting } from "../../src/db/settings";
import { syncFromSheetUrl } from "../../src/utils/csvImport";
import { exportCSV } from "../../src/utils/csvExport";
import { syncFromScript, exportToScript } from "../../src/utils/scriptSync";
import { formatSyncTime } from "../../src/utils/formatTime";
import type { UserSettings, ForeignLanguage } from "../../src/types";
import { DEFAULT_SETTINGS } from "../../src/types";
import { FOREIGN_LANGUAGE_LABELS } from "../../src/constants";

const SCRIPT_URL_KEY = "scriptSyncUrl";
const LAST_IMPORT_KEY = "scriptLastImportAt";
const LAST_EXPORT_KEY = "scriptLastExportAt";

const APP_VERSION = "1.0.0";
const GITHUB_REPO = "DYK1323/interpretation-practice";

const SPEEDS = [
  { value: 0.5, label: "0.5x (매우 느리게)" },
  { value: 0.75, label: "0.75x (느리게)" },
  { value: 1.0, label: "1.0x (보통)" },
];
const PRESET_SPEEDS = SPEEDS.map((s) => s.value);

const PRESET_LIMITS = [10, 20, 30];

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportGuideVisible, setExportGuideVisible] = useState(false);
  const [syncGuideVisible, setSyncGuideVisible] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const limitInputRef = useRef<TextInput>(null);
  const [customSpeedText, setCustomSpeedText] = useState("");
  const [scriptSyncUrl, setScriptSyncUrl] = useState<string | null>(null);
  const [scriptImporting, setScriptImporting] = useState(false);
  const [scriptExporting, setScriptExporting] = useState(false);
  const [lastImportAt, setLastImportAt] = useState<number | null>(null);
  const [lastExportAt, setLastExportAt] = useState<number | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      getStringSetting(SCRIPT_URL_KEY).then((v) => setScriptSyncUrl(v ?? null));
      getStringSetting(LAST_IMPORT_KEY).then((v) => { if (v) setLastImportAt(Number(v)); });
      getStringSetting(LAST_EXPORT_KEY).then((v) => { if (v) setLastExportAt(Number(v)); });
    }, [])
  );

  async function loadSettings() {
    const s = await getAllSettings();
    setSettings(s);
    if (!PRESET_SPEEDS.includes(s.playbackSpeed)) {
      setCustomSpeedText(String(s.playbackSpeed));
    }
    const url = await getStringSetting("sheetSyncUrl");
    if (url) setSheetUrl(url);
  }

  async function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    await setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleCustomSpeed() {
    const v = parseFloat(customSpeedText);
    if (isNaN(v) || v < 0.1 || v > 2.0) {
      Alert.alert("0.1 ~ 2.0 사이 숫자를 입력하세요");
      setCustomSpeedText("");
      return;
    }
    const rounded = Math.round(v * 100) / 100;
    updateSetting("playbackSpeed", rounded);
    setCustomSpeedText(String(rounded));
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

  function getOtaInfo(): string {
    if (__DEV__) return "개발 환경";
    if (Updates.isEmbeddedLaunch) return "기본 번들";
    const id = Updates.updateId;
    const date = Updates.createdAt;
    if (!id) return "—";
    const shortId = id.slice(0, 8) + "…";
    if (!date) return shortId;
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");
    return `${shortId} (${m}/${d} ${h}:${min})`;
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      let otaAvailable = false;
      try {
        const result = await Updates.checkForUpdateAsync();
        otaAvailable = result.isAvailable;
      } catch {}

      let nativeUpdateVersion: string | null = null;
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
        if (res.ok) {
          const data = await res.json();
          const latest = (data.tag_name as string).replace(/^v/, "");
          if (latest !== APP_VERSION) nativeUpdateVersion = latest;
        }
      } catch {}

      if (otaAvailable) {
        Alert.alert(
          "업데이트 사용 가능",
          "새 업데이트가 있습니다. 지금 적용하면 앱이 재시작됩니다.",
          [
            { text: "나중에", style: "cancel" },
            {
              text: "지금 적용",
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (e: any) {
                  Alert.alert("업데이트 실패", e?.message ?? "알 수 없는 오류");
                }
              },
            },
          ]
        );
      } else if (nativeUpdateVersion) {
        Alert.alert(
          `새 버전 v${nativeUpdateVersion} 출시`,
          "새 APK가 있습니다. GitHub Releases에서 다운로드하세요.",
          [{ text: "확인" }]
        );
      } else {
        const msg = "최신 버전입니다.";
        if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
        else Alert.alert("업데이트 확인", msg);
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleScriptImport() {
    if (!scriptSyncUrl) return;
    setScriptImporting(true);
    try {
      const { imported, failed } = await syncFromScript(scriptSyncUrl);
      const now = Date.now();
      await setStringSetting(LAST_IMPORT_KEY, String(now));
      setLastImportAt(now);
      Alert.alert("가져오기 완료", `${imported}개 문장 가져옴${failed > 0 ? `, ${failed}개 실패` : ""}`);
    } catch (e: any) {
      Alert.alert("가져오기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setScriptImporting(false);
    }
  }

  async function handleScriptExport() {
    if (!scriptSyncUrl) return;
    setScriptExporting(true);
    try {
      const count = await exportToScript(scriptSyncUrl);
      const now = Date.now();
      await setStringSetting(LAST_EXPORT_KEY, String(now));
      setLastExportAt(now);
      if (Platform.OS === "android") ToastAndroid.show(`${count}개 문장 내보내기 완료`, ToastAndroid.SHORT);
      else Alert.alert("내보내기 완료", `${count}개 문장을 시트에 내보냈습니다.`);
    } catch (e: any) {
      Alert.alert("내보내기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setScriptExporting(false);
    }
  }

  function handleSyncPress() {
    const url = sheetUrl.trim();
    if (!url) {
      Alert.alert("URL 필요", "구글 시트 공유 링크를 입력하세요.");
      return;
    }
    setSyncGuideVisible(true);
  }

  async function handleSync() {
    setSyncGuideVisible(false);
    const url = sheetUrl.trim();
    await setStringSetting("sheetSyncUrl", url);
    setSyncing(true);
    try {
      const { imported, failed } = await syncFromSheetUrl(url);
      Alert.alert(
        "가져오기 완료",
        `${imported}개 문장 가져옴${failed > 0 ? `, ${failed}개 실패` : ""}`
      );
    } catch (e: any) {
      Alert.alert("가져오기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setSyncing(false);
    }
  }

  async function handleExport() {
    setExportGuideVisible(false);
    setExporting(true);
    try {
      const count = await exportCSV();
      if (count === 0) {
        Alert.alert("내보낼 문장 없음", "라이브러리에 문장을 추가하세요.");
      } else if (Platform.OS === "android") {
        ToastAndroid.show(`${count}개 문장 내보내기 완료`, ToastAndroid.SHORT);
      } else {
        Alert.alert("내보내기 완료", `${count}개 문장을 내보냈습니다.`);
      }
    } catch (e: any) {
      Alert.alert("내보내기 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 구글 시트에서 가져오기 — 양방향 동기화 미설정 시에만 표시 */}
      {!scriptSyncUrl && <View style={styles.group}>
        <Text style={styles.groupTitle}>구글 시트에서 가져오기</Text>
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
          onPress={handleSyncPress}
          disabled={syncing}
        >
          {syncing
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.actionBtnText}>시트에서 문장 가져오기</Text>
          }
        </TouchableOpacity>
      </View>}

      {/* 양방향 동기화 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>양방향 동기화</Text>
        {!scriptSyncUrl ? (
          <>
            <Text style={styles.desc}>
              Google Apps Script를 통해 앱과 스프레드시트를 양방향으로 동기화합니다.
            </Text>
            <TouchableOpacity style={styles.advancedSyncBtn} onPress={() => router.push("/sync-setup")}>
              <Text style={styles.advancedSyncBtnText}>설정하기 →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, scriptImporting && styles.actionBtnDisabled]}
              onPress={handleScriptImport}
              disabled={scriptImporting}
            >
              {scriptImporting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.actionBtnText}>시트 → 앱으로 가져오기</Text>
              }
            </TouchableOpacity>
            {lastImportAt != null && (
              <Text style={styles.hint}>마지막 가져오기: {formatSyncTime(lastImportAt)}</Text>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary, scriptExporting && styles.actionBtnDisabled]}
              onPress={handleScriptExport}
              disabled={scriptExporting}
            >
              {scriptExporting
                ? <ActivityIndicator size="small" color="#1A56DB" />
                : <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>앱 → 시트로 내보내기</Text>
              }
            </TouchableOpacity>
            {lastExportAt != null && (
              <Text style={styles.hint}>마지막 내보내기: {formatSyncTime(lastExportAt)}</Text>
            )}
            <TouchableOpacity style={styles.advancedSyncBtn} onPress={() => router.push("/sync-setup")}>
              <Text style={styles.advancedSyncBtnText}>설정 변경 →</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* CSV 내보내기 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>데이터 내보내기</Text>
        <Text style={styles.desc}>
          문장과 학습 진도(복습 일정·횟수)를 CSV로 내보냅니다. 구글 드라이브에 저장해두면 폰을 바꿔도 시트 가져오기로 복원할 수 있습니다.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary, exporting && styles.actionBtnDisabled]}
          onPress={() => setExportGuideVisible(true)}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#1A56DB" />
            : <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>CSV 내보내기</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>공유 창에서 구글 드라이브를 선택하세요</Text>
      </View>

      {/* 연습 언어 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>연습 언어</Text>
        <Text style={styles.desc}>선택한 언어쌍으로 라이브러리와 연습이 자동 전환됩니다.</Text>
        <View style={styles.chipRow}>
          {(["en", "ja", "zh"] as ForeignLanguage[]).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.chip, settings.foreignLanguage === lang && styles.chipActive]}
              onPress={() => {
                if (settings.foreignLanguage === lang) return;
                Alert.alert(
                  "언어 변경",
                  "언어를 바꾸면 라이브러리와 학습이 해당 언어 기준으로 전환됩니다.",
                  [
                    { text: "취소", style: "cancel" },
                    { text: "변경", onPress: () => updateSetting("foreignLanguage", lang) },
                  ]
                );
              }}
            >
              <Text style={[styles.chipText, settings.foreignLanguage === lang && styles.chipTextActive]}>
                {FOREIGN_LANGUAGE_LABELS[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>분리 세션 모드</Text>
            <Text style={styles.rowDesc}>
              통역을 모두 먼저 녹음한 뒤{"\n"}
              재통역·비교를 순서대로 진행합니다.
            </Text>
          </View>
          <Switch
            value={settings.splitSessionMode}
            onValueChange={(v) => updateSetting("splitSessionMode", v)}
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
            onPress={() => {
              updateSetting("playbackSpeed", s.value);
              setCustomSpeedText("");
            }}
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
        <View style={styles.radioRow}>
          <View
            style={[
              styles.radioCircle,
              !PRESET_SPEEDS.includes(settings.playbackSpeed) && styles.radioCircleActive,
            ]}
          />
          <Text style={styles.radioLabel}>직접 입력  </Text>
          <TextInput
            style={styles.speedInput}
            keyboardType="decimal-pad"
            placeholder="예: 0.6"
            placeholderTextColor="#9CA3AF"
            value={customSpeedText}
            onChangeText={setCustomSpeedText}
            onBlur={handleCustomSpeed}
            returnKeyType="done"
            onSubmitEditing={handleCustomSpeed}
          />
          <Text style={styles.radioLabel}>x</Text>
        </View>
        <Text style={styles.speedHint}>0.1 ~ 2.0 범위로 입력</Text>
      </View>

      {/* 정보 */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전</Text>
          <Text style={styles.infoValue}>{APP_VERSION}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>OTA 업데이트</Text>
          <Text style={styles.infoValue}>{getOtaInfo()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>저장소</Text>
          <Text style={styles.infoValue}>기기 로컬 (SQLite)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>오디오 엔진</Text>
          <Text style={styles.infoValue}>expo-audio + expo-speech</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>음성 인식</Text>
          <Text style={styles.infoValue}>기기 내장 (무료)</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary, checkingUpdate && styles.actionBtnDisabled]}
          onPress={handleCheckUpdate}
          disabled={checkingUpdate}
        >
          {checkingUpdate
            ? <ActivityIndicator size="small" color="#1A56DB" />
            : <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>업데이트 확인</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>

      {/* 내보내기 안내 */}
      <Modal
        visible={exportGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>CSV 내보내기 안내</Text>
            <View style={styles.stepList}>
              <Text style={styles.stepItem}>① 공유 창이 열리면 <Text style={styles.stepEmphasis}>구글 드라이브</Text>를 선택하세요.</Text>
              <Text style={styles.stepItem}>② 드라이브에 저장해 두면 폰을 바꿔도 복원할 수 있습니다.</Text>
              <Text style={styles.stepItem}>③ 복원할 때는 파일을 구글 시트로 열어 가져오기 URL로 입력하세요.</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setExportGuideVisible(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleExport}>
                <Text style={styles.modalConfirmText}>내보내기 시작</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 동기화 안내 */}
      <Modal
        visible={syncGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSyncGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>시트 공유 설정을 미리 확인해주세요</Text>
              <View style={styles.stepList}>
                <Text style={styles.stepItem}>① 구글 스프레드시트를 엽니다.</Text>
                <Text style={styles.stepItem}>② 오른쪽 상단 <Text style={styles.stepEmphasis}>공유</Text> 버튼을 누릅니다.</Text>
                <Text style={styles.stepItem}>③ <Text style={styles.stepEmphasis}>"링크 있는 모든 사용자"</Text> → <Text style={styles.stepEmphasis}>"뷰어"</Text>로 설정합니다.</Text>
                <Text style={styles.stepItem}>④ 링크를 복사해 위 입력칸에 붙여넣습니다.</Text>
              </View>
              <View style={styles.columnGuide}>
                <Text style={styles.columnGuideTitle}>1행(헤더) 컬럼명</Text>
                {([
                  { name: "sourceText",      desc: "원문 — 영어·일본어·중국어 중 해당 언어 텍스트",  required: true },
                  { name: "foreignLanguage", desc: "언어쌍 (en / ja / zh). 생략 시 en으로 처리.",   required: false },
                  { name: "koreanText",      desc: "한국어 원문 — 한→외 연습 활성화",               required: false },
                  { name: "modelKorean",     desc: "외→한 연습 3단계 '통역 예시(한국어)'. 비워두면 koreanText 표시.", required: false },
                  { name: "modelSource",     desc: "한→외 연습 3단계 '통역 예시(원문 언어)'. 비워두면 sourceText 표시.", required: false },
                  { name: "category",        desc: "분류 (news/business/conference/daily)",        required: false },
                  { name: "difficulty",      desc: "난이도 (1·2·3)",                               required: false },
                  { name: "tags",            desc: "태그 (|로 구분)",                               required: false },
                  { name: "notes",           desc: "메모",                                          required: false },
                ] as const).map(({ name, desc, required }) => (
                  <View key={name} style={styles.columnRow}>
                    <Text style={[styles.columnName, required && styles.columnNameRequired]}>{name}</Text>
                    <Text style={styles.columnDesc}>{required ? "[필수] " : ""}{desc}</Text>
                  </View>
                ))}
                <Text style={styles.columnGuideHint}>
                  앱에서 내보낸 CSV를 구글 시트로 열면 헤더가 자동으로 맞춰집니다.
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSyncGuideVisible(false)}>
                  <Text style={styles.modalCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSync}>
                  <Text style={styles.modalConfirmText}>가져오기 시작</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={limitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLimitModalVisible(false)}
        onShow={() => limitInputRef.current?.focus()}
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
    </>
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
  advancedSyncBtn: { alignSelf: "flex-start", marginTop: 12 },
  advancedSyncBtnText: { fontSize: 13, color: "#1A56DB", textDecorationLine: "underline" },
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
  speedInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 15,
    color: "#111827",
    minWidth: 60,
    textAlign: "center",
  },
  speedHint: { fontSize: 12, color: "#9CA3AF", marginTop: 4, marginLeft: 32 },
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
  stepList: { gap: 10 },
  stepItem: { fontSize: 13, color: "#374151", lineHeight: 20 },
  stepEmphasis: { fontWeight: "700", color: "#1A56DB" },
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
  modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  columnGuide: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  columnGuideTitle: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 2 },
  columnRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  columnName: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, color: "#1A56DB", minWidth: 100 },
  columnNameRequired: { color: "#DC2626" },
  columnDesc: { fontSize: 11, color: "#6B7280", flex: 1, lineHeight: 16 },
  columnGuideHint: { fontSize: 11, color: "#9CA3AF", lineHeight: 16, marginTop: 4 },
});
