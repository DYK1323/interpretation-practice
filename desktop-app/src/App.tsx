import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  DIFFICULTY_OPTIONS,
  DIRECTION_LABELS,
  FOREIGN_LANGUAGE_DIRECTIONS,
  FOREIGN_LANGUAGE_LABELS,
  LANG_LABEL,
  modelInterpretation,
  sourceLangCode,
  type Category,
  type Direction,
  type ForeignLanguage,
  type SentenceEntry,
  type SessionResult,
  type SessionStep,
  type UserSettings,
} from "./core/types";
import { exportCSVContent } from "./core/csv";
import { getNextStep, getSTTLocale } from "./core/session";
import * as api from "./tauri/api";

type Tab = "practice" | "library" | "history" | "settings";
type QueueItem = { sentence: SentenceEntry; direction: Direction; isRetry?: boolean; intervalDays?: number; interpUri?: string };
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternative;
  isFinal: boolean;
};
type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};
type SpeechRecognitionErrorEventLike = Event & { error?: string };
type SpeechRecognitionLike = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const SPEEDS = [
  { value: 0.5, label: "0.5x (매우 느리게)" },
  { value: 0.75, label: "0.75x (느리게)" },
  { value: 1.0, label: "1.0x (보통)" },
];
const PRESET_SPEEDS = SPEEDS.map((speed) => speed.value);
const PRESET_LIMITS = [10, 20, 30];
const DIFFICULTIES: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: "★☆☆" },
  { value: 2, label: "★★☆" },
  { value: 3, label: "★★★" },
];

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

const SYNC_STEPS = [
  "사용할 구글 스프레드시트를 엽니다.",
  "상단 메뉴: 확장 프로그램 → Apps Script",
  "편집기의 기존 코드를 모두 지우고 아래 스크립트를 붙여넣은 뒤 저장(Ctrl+S)합니다.",
  "오른쪽 위 배포 → 새 배포를 누릅니다.\n유형: 웹 앱 / 다음 사용자로 실행: 나 / 액세스 권한: 모든 사용자\n→ 배포 후 Google 계정 권한 허용",
  "표시된 웹 앱 URL을 복사해 아래에 붙여넣습니다.",
];

function newId() {
  return `custom_${Date.now()}`;
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sentencePrimaryText(sentence: SentenceEntry): string {
  if (sentence.foreignLanguage === "ja") return sentence.japaneseText ?? "";
  if (sentence.foreignLanguage === "zh") return sentence.chineseText ?? "";
  return sentence.englishText;
}

function sourceForDirection(sentence: SentenceEntry, direction: Direction): string {
  if (direction.startsWith("ko-")) return sentence.koreanText ?? "";
  return sentencePrimaryText(sentence);
}

function sentenceAudio(sentence: SentenceEntry, direction: Direction) {
  if (direction.startsWith("ko-")) return sentence.koreanAudio;
  if (direction === "ja-ko") return sentence.japaneseAudio;
  if (direction === "zh-ko") return sentence.chineseAudio;
  return sentence.englishAudio;
}

function foreignModelKey(language: ForeignLanguage): "modelEnglish" | "modelJapanese" | "modelChinese" {
  if (language === "ja") return "modelJapanese";
  if (language === "zh") return "modelChinese";
  return "modelEnglish";
}

function foreignModelLabel(language: ForeignLanguage): string {
  if (language === "ja") return "통역 예시 — 일본어";
  if (language === "zh") return "통역 예시 — 중국어";
  return "통역 예시 — 영어";
}

function foreignModelDirectionLabel(language: ForeignLanguage): string {
  if (language === "ja") return "한→일 연습 전용";
  if (language === "zh") return "한→중 연습 전용";
  return "한→영 연습 전용";
}

function koreanDirectionLabel(language: ForeignLanguage): string {
  if (language === "ja") return "일→한 연습 전용";
  if (language === "zh") return "중→한 연습 전용";
  return "영→한 연습 전용";
}

function koreanPracticeDescription(language: ForeignLanguage): string {
  if (language === "ja") return "한→일 연습 활성화";
  if (language === "zh") return "한→중 연습 활성화";
  return "한→영 연습 활성화";
}

async function playAudioUri(uri: string) {
  const audio = new Audio(uri) as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
  const sinkId = await api.getStringSetting("speakerDeviceId");
  if (sinkId && audio.setSinkId) await audio.setSinkId(sinkId);
  await audio.play();
}

function daysAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

function daysUntil(ts: number): string {
  const days = Math.floor((ts - Date.now()) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "내일";
  return `${days}일 후`;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function App() {
  const [tab, setTab] = useState<Tab>("practice");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [sentences, setSentences] = useState<SentenceEntry[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [dbPath, setDbPath] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [originalQueueLength, setOriginalQueueLength] = useState(0);
  const [sessionStep, setSessionStep] = useState<SessionStep>("LISTEN_RECORD");
  const [sessionDraft, setSessionDraft] = useState({ interpUri: "", backUri: "", backText: "", notes: "" });
  const [savedSplitSession, setSavedSplitSession] = useState<{
    queue: QueueItem[]; queueIndex: number; origLen: number;
  } | null>(null);
  const activeQueueItem = queue.length > 0 ? queue[queueIndex] : null;

  function startQueue(items: QueueItem[]) {
    setQueue(items);
    setQueueIndex(0);
    setOriginalQueueLength(items.length);
  }

  async function refresh() {
    const loadedSettings = await api.getAllSettings();
    setSettings(loadedSettings);
    setSentences(await api.getAllSentences(loadedSettings.foreignLanguage));
    setResults(await api.getResults(100));
  }

  useEffect(() => {
    api.initDB().then(setDbPath).then(refresh).catch((error) => alert(String(error)));
  }, []);

  // Bug 3: load previous session notes when entering COMPARE
  useEffect(() => {
    if (sessionStep !== "COMPARE" || sessionDraft.notes || !activeQueueItem) return;
    const prev = results.find(
      r => r.sentenceId === activeQueueItem.sentence.id && r.direction === activeQueueItem.direction
    );
    if (prev?.notes) setSessionDraft(d => ({ ...d, notes: prev.notes! }));
  }, [sessionStep]);

  function exitSession() {
    // Bug 1: save split session progress before clearing
    if (settings.splitSessionMode && queue.some(item => item.interpUri)) {
      setSavedSplitSession({ queue, queueIndex, origLen: originalQueueLength });
    }
    setQueue([]);
    setQueueIndex(0);
    setOriginalQueueLength(0);
    setSessionStep("LISTEN_RECORD");
    setSessionDraft({ interpUri: "", backUri: "", backText: "", notes: "" });
  }

  function handleResumeSplit() {
    if (!savedSplitSession) return;
    const { queue: sq, queueIndex: sq_idx, origLen } = savedSplitSession;
    setQueue(sq);
    setQueueIndex(sq_idx);
    setOriginalQueueLength(origLen);
    const item = sq[sq_idx];
    setSessionStep(item?.interpUri ? "PLAYBACK_BACK" : "LISTEN_RECORD");
    setSessionDraft({ interpUri: item?.interpUri ?? "", backUri: "", backText: "", notes: "" });
    setSavedSplitSession(null);
  }

  function handleInterpComplete(uri: string) {
    if (settings.splitSessionMode && queueIndex < originalQueueLength) {
      const updatedQueue = [...queue];
      updatedQueue[queueIndex] = { ...updatedQueue[queueIndex], interpUri: uri };
      if (queueIndex < originalQueueLength - 1) {
        setQueue(updatedQueue);
        setQueueIndex(queueIndex + 1);
        setSessionStep("LISTEN_RECORD");
        setSessionDraft({ interpUri: "", backUri: "", backText: "", notes: "" });
      } else {
        const reviewItems = updatedQueue.slice(0, originalQueueLength).map((item) => ({ ...item, isRetry: false }));
        const fullQueue = [...updatedQueue, ...reviewItems];
        setQueue(fullQueue);
        setQueueIndex(originalQueueLength);
        setSessionStep("PLAYBACK_BACK");
        setSessionDraft({ interpUri: reviewItems[0].interpUri ?? "", backUri: "", backText: "", notes: "" });
      }
    } else {
      setSessionDraft({ ...sessionDraft, interpUri: uri });
      setSessionStep("PLAYBACK_BACK");
    }
  }

  function openTab(nextTab: Tab) {
    if (activeQueueItem && nextTab !== "practice") exitSession();
    setTab(nextTab);
  }

  async function finishSentence(difficulty: 1 | 2 | 3) {
    const item = queue[queueIndex];
    if (!item) return;
    const originalText = sourceForDirection(item.sentence, item.direction);
    await api.saveResult({
      id: `${item.sentence.id}_${item.direction}_${Date.now()}`,
      sentenceId: item.sentence.id,
      direction: item.direction,
      timestamp: Date.now(),
      interpRecordingUri: sessionDraft.interpUri || undefined,
      backInterpRecordingUri: sessionDraft.backUri || undefined,
      backInterpText: sessionDraft.backText,
      originalText,
      notes: sessionDraft.notes.trim() || undefined,
    });

    const isRetry = item.isRetry ?? false;

    function advanceToNext(newQueue: QueueItem[], nextIdx: number) {
      const nextItem = newQueue[nextIdx];
      setSessionStep(nextItem?.interpUri ? "PLAYBACK_BACK" : "LISTEN_RECORD");
      setSessionDraft({ interpUri: nextItem?.interpUri ?? "", backUri: "", backText: "", notes: "" });
    }

    if (difficulty === 3) {
      if (!isRetry) {
        await api.scheduleReview(item.sentence.id, item.direction, 0);
      }
      const newQueue = [...queue, { ...item, isRetry: true, interpUri: undefined }];
      setQueue(newQueue);
      const nextIdx = queueIndex + 1;
      setQueueIndex(nextIdx);
      advanceToNext(newQueue, nextIdx);
    } else {
      let days: number;
      if (isRetry) {
        days = difficulty === 2 ? 1 : 3;
      } else {
        const progress = await api.getProgress(item.sentence.id, item.direction);
        if (progress && progress.intervalDays > 0) {
          const multiplier = difficulty === 2 ? 2.5 : 3.5;
          days = Math.max(1, Math.round(progress.intervalDays * multiplier));
        } else {
          days = difficulty === 2 ? 1 : 3;
        }
      }
      await api.scheduleReview(item.sentence.id, item.direction, days);
      await api.upsertSentence({ ...item.sentence, difficulty });

      const nextIdx = queueIndex + 1;
      if (nextIdx < queue.length) {
        setQueueIndex(nextIdx);
        advanceToNext(queue, nextIdx);
      } else {
        exitSession();
        await refresh();
      }
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">IP</span>
          <div>
            <strong>통역 연습</strong>
            <small>Desktop · UTF-8 · SQLite</small>
          </div>
        </div>
        {[
          ["practice", "연습"],
          ["library", "라이브러리"],
          ["history", "히스토리"],
          ["settings", "설정"],
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? "nav active" : "nav"} onClick={() => openTab(key as Tab)}>
            {label}
          </button>
        ))}
        <div className="sidebarNote">
          <span>DB</span>
          <code>{dbPath || "초기화 중"}</code>
        </div>
      </aside>

      <main className="main">
        {activeQueueItem && tab === "practice" ? (
          <SessionView
            item={activeQueueItem}
            index={queueIndex}
            total={queue.length}
            originalQueueLength={originalQueueLength}
            step={sessionStep}
            draft={sessionDraft}
            settings={settings}
            setStep={setSessionStep}
            setDraft={setSessionDraft}
            onExit={exitSession}
            onFinish={finishSentence}
            onInterpComplete={handleInterpComplete}
          />
        ) : tab === "practice" ? (
          <PracticeView
            settings={settings}
            sentences={sentences}
            results={results}
            startQueue={startQueue}
            refresh={refresh}
            savedSplitSession={savedSplitSession}
            onResumeSplit={handleResumeSplit}
            onClearSavedSplit={() => setSavedSplitSession(null)}
          />
        ) : tab === "library" ? (
          <LibraryView settings={settings} sentences={sentences} refresh={refresh} startSingle={(item) => startQueue([item])} />
        ) : tab === "history" ? (
          <HistoryView results={results} sentences={sentences} refresh={refresh} />
        ) : (
          <SettingsView settings={settings} setSettings={setSettings} refresh={refresh} sentences={sentences} />
        )}
      </main>
    </div>
  );
}

function PracticeView({ settings, sentences, results, startQueue, refresh, savedSplitSession, onResumeSplit, onClearSavedSplit }: {
  settings: UserSettings;
  sentences: SentenceEntry[];
  results: SessionResult[];
  startQueue: (items: QueueItem[]) => void;
  refresh: () => Promise<void>;
  savedSplitSession: { queue: QueueItem[]; queueIndex: number; origLen: number } | null;
  onResumeSplit: () => void;
  onClearSavedSplit: () => void;
}) {
  const [direction, setDirection] = useState<Direction>(FOREIGN_LANGUAGE_DIRECTIONS[settings.foreignLanguage][0]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [queuePreview, setQueuePreview] = useState<QueueItem[]>([]);

  useEffect(() => {
    const dirs = FOREIGN_LANGUAGE_DIRECTIONS[settings.foreignLanguage];
    if (!dirs.includes(direction)) setDirection(dirs[0]);
  }, [settings.foreignLanguage]);

  useEffect(() => {
    api.getPracticeQueue(settings.foreignLanguage, direction, selectedCategory, settings.dailyNewLimit).then(setQueuePreview);
  }, [settings, direction, selectedCategory]);

  async function start() {
    const items = settings.shuffleSentences ? shuffle(queuePreview) : queuePreview;
    startQueue(items);
    await refresh();
  }

  async function handleExtraNew() {
    const items = await api.getNewSentences(settings.foreignLanguage, direction, selectedCategory, 10);
    if (items.length === 0) { alert("새로 학습할 문장이 없습니다."); return; }
    startQueue(settings.shuffleSentences ? shuffle(items) : items);
    await refresh();
  }

  async function handleReviewToday() {
    const items = await api.getTodaySentences(settings.foreignLanguage);
    if (items.length === 0) { alert("오늘 학습한 문장이 없습니다."); return; }
    startQueue(settings.shuffleSentences ? shuffle(items) : items);
    await refresh();
  }

  const today = new Date().toDateString();
  const todayCount = results.filter((result) => new Date(result.timestamp).toDateString() === today).length;
  const totalSentences = new Set(results.map((result) => result.sentenceId)).size;
  const retryCount = queuePreview.filter((item) => item.intervalDays === 0).length;
  const dueCount = queuePreview.filter((item) => item.intervalDays !== undefined && item.intervalDays > 0).length;
  const newCount = queuePreview.filter((item) => item.intervalDays === undefined).length;
  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {};
    results.forEach((result) => {
      const key = toLocalDateString(new Date(result.timestamp));
      data[key] = (data[key] ?? 0) + 1;
    });
    return data;
  }, [results]);

  return (
    <section className="screen">
      <div className="statsBar">
        <div className="statItem"><span>🔥</span><strong>0</strong><small>연속</small></div>
        <div className="statDivider" />
        <div className="statItem"><span>📚</span><strong>{totalSentences}</strong><small>문장</small></div>
        <div className="statDivider" />
        <div className="statItem"><span>✅</span><strong>{todayCount}</strong><small>오늘</small></div>
      </div>

      {savedSplitSession && (
        <div className="resumeCard">
          <p>분리 세션 진행 중 — {savedSplitSession.queueIndex + 1}/{savedSplitSession.origLen}번째</p>
          <div className="resumeCardActions">
            <button className="primary" onClick={onResumeSplit}>이어서 계속하기</button>
            <button className="ghost" onClick={onClearSavedSplit}>취소</button>
          </div>
        </div>
      )}

      <div className="queueCard">
        <div className="queueTitleRow">
          <h1>오늘의 학습</h1>
          <div className="badges">
            {retryCount > 0 && <span className="retryBadgeMain">재도전 {retryCount}</span>}
            {dueCount > 0 && <span className="dueBadge">복습 {dueCount}</span>}
            {newCount > 0 && <span className="newBadge">새 문장 {newCount}</span>}
          </div>
        </div>

        <div className="filterSection">
          <h2>새 문장 방향</h2>
          <div className="chips">
            {FOREIGN_LANGUAGE_DIRECTIONS[settings.foreignLanguage].map((dir) => (
              <button key={dir} className={direction === dir ? "chip active" : "chip"} onClick={() => setDirection(dir)}>
                {DIRECTION_LABELS[dir]}
              </button>
            ))}
          </div>
          <h2>카테고리</h2>
          <div className="chips">
            <button className={!selectedCategory ? "chip active" : "chip"} onClick={() => setSelectedCategory(null)}>전체</button>
            {CATEGORIES.map((category) => (
              <button
                key={category.key}
                className={selectedCategory === category.key ? "chip active" : "chip"}
                onClick={() => setSelectedCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
          <p className="newLimit">새 문장은 최대 {settings.dailyNewLimit}개까지 추가됩니다</p>
        </div>

        {queuePreview.length > 0 ? (
          <button className="startBtn" onClick={start}>
            시작하기  {queuePreview.length}문장
          </button>
        ) : (
          <div className="doneSection">
            <p className="doneText">오늘 학습을 완료했어요! 🎉</p>
            <button className="startBtn" onClick={handleExtraNew}>새 문장 더 학습하기</button>
            <button className="startBtnSecondary" onClick={handleReviewToday}>오늘 학습한 문장 다시 연습</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>최근 12주</h2>
        <Heatmap data={heatmapData} weeks={12} />
      </div>

      {sentences.length === 0 && (
        <div className="empty">
          <strong>문장이 없습니다</strong>
          <span>설정에서 구글 시트를 동기화하거나 라이브러리에서 직접 추가해보세요.</span>
        </div>
      )}
    </section>
  );
}

function SessionView({ item, index, total, originalQueueLength, step, draft, settings, setStep, setDraft, onExit, onFinish, onInterpComplete }: {
  item: QueueItem;
  index: number;
  total: number;
  originalQueueLength: number;
  step: SessionStep;
  draft: { interpUri: string; backUri: string; backText: string; notes: string };
  settings: UserSettings;
  setStep: (step: SessionStep) => void;
  setDraft: (draft: { interpUri: string; backUri: string; backText: string; notes: string }) => void;
  onExit: () => void;
  onFinish: (difficulty: 1 | 2 | 3) => Promise<void>;
  onInterpComplete: (uri: string) => void;
}) {
  const recorder = useRecorder();
  const originalText = sourceForDirection(item.sentence, item.direction);
  const modelText = modelInterpretation(item.sentence, item.direction);
  const stepIndex = (["LISTEN_RECORD", "PLAYBACK_BACK", "COMPARE"] as SessionStep[]).indexOf(step);
  const [srcLang, tgtLang] = item.direction.split("-");
  const origLen = originalQueueLength || total;
  const isReviewPass = settings.splitSessionMode && index >= origLen;
  const passLabel = settings.splitSessionMode ? (isReviewPass ? "복습" : "통역") : null;
  const displayIndex = isReviewPass ? index - origLen : index;
  const displayTotal = settings.splitSessionMode ? origLen : total;
  const [pendingInterpUri, setPendingInterpUri] = useState<string | null>(null);
  const [daysPreview, setDaysPreview] = useState<Record<number, number>>({ 1: 3, 2: 1 });
  useEffect(() => { setPendingInterpUri(null); }, [index]);
  useEffect(() => {
    if (step !== "COMPARE") return;
    api.getProgress(item.sentence.id, item.direction).then(prog => {
      const base = prog?.intervalDays ?? 0;
      setDaysPreview({
        1: base > 0 ? Math.max(1, Math.round(base * 3.5)) : 3,
        2: base > 0 ? Math.max(1, Math.round(base * 2.5)) : 1,
      });
    });
  }, [step]);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const stt = useLiveSTT(getSTTLocale(item.direction), (text) => {
    if (text.trim()) setDraft({ ...draftRef.current, backText: text.trim() });
  });

  async function playSource() {
    const audio = sentenceAudio(item.sentence, item.direction);
    if (audio?.type === "file") await playAudioUri(audio.uri);
    else await api.speakText(originalText, sourceLangCode(item.direction), settings.playbackSpeed);
  }

  async function record(kind: "interp" | "back") {
    if (!recorder.recording) {
      if (kind === "back") stt.startListening();
      await recorder.start();
      return;
    }
    const uri = await recorder.stop();
    if (kind === "interp") {
      if (settings.splitSessionMode && !isReviewPass) {
        setPendingInterpUri(uri);
      } else {
        onInterpComplete(uri);
      }
    } else {
      stt.stopListening();
      setDraft({ ...draftRef.current, backUri: uri, backText: stt.transcript.trim() || draftRef.current.backText });
      setStep(getNextStep("PLAYBACK_BACK")!);
    }
  }

  const stepDesc = step === "LISTEN_RECORD"
    ? `${LANG_LABEL[item.direction.split("-")[0]]}를 듣고 ${LANG_LABEL[item.direction.split("-")[1]]}로 통역하세요`
    : step === "PLAYBACK_BACK"
      ? `내 통역을 듣고 ${LANG_LABEL[item.direction.split("-")[0]]}로 재통역하세요`
      : "원문과 비교하세요";

  return (
    <section className="screen session">
      <header className="sessionHeader">
        <div className="sessionHeaderRow">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{passLabel ? `${passLabel} ` : ""}{displayIndex + 1} / {displayTotal}</strong>
            {item.isRetry && <span className="retryBadge">재도전</span>}
          </div>
          <div className="stepIndicator">
            <StepMark label="듣기/통역" number={1} active={step === "LISTEN_RECORD"} done={stepIndex > 0} />
            <i className={stepIndex > 0 ? "done" : ""} />
            <StepMark label="확인/재통역" number={2} active={step === "PLAYBACK_BACK"} done={stepIndex > 1} />
            <i className={stepIndex > 1 ? "done" : ""} />
            <StepMark label="비교" number={3} active={step === "COMPARE"} done={false} />
          </div>
          <button className="ghost" onClick={onExit}>나가기</button>
        </div>
      </header>

      {step === "LISTEN_RECORD" && !pendingInterpUri && (
        <div className="focusCard">
          <p className="stepDesc">{stepDesc}</p>
          {settings.showSourceTextDuringListen && <blockquote>{originalText}</blockquote>}
          <button className="listenAction" onClick={playSource}>
            <span aria-hidden="true">▶</span>
            듣기
          </button>
          <p className="subLabel">준비되면 통역을 녹음하세요</p>
          {recorder.recording && <span className="recordTimer">{recorder.formattedElapsed}</span>}
          <button className={recorder.recording ? "recordAction recording" : "recordAction"} onClick={() => record("interp")} aria-label={recorder.recording ? "탭하여 완료" : "탭하여 녹음 시작"}>
            <span aria-hidden="true">{recorder.recording ? "■" : "●"}</span>
          </button>
          <span className="recordLabel">{recorder.recording ? "탭하여 완료" : "탭하여 녹음 시작"}</span>
        </div>
      )}

      {step === "LISTEN_RECORD" && !!pendingInterpUri && (
        <div className="focusCard">
          <p className="stepDesc">모범 통역</p>
          <blockquote>{originalText}</blockquote>
          {modelText
            ? <div className="modelBox"><span className="modelLabel">모범</span><p>{modelText}</p></div>
            : <p className="errorText">모범 통역이 없습니다.</p>
          }
          <button className="primary" onClick={() => { onInterpComplete(pendingInterpUri!); setPendingInterpUri(null); }}>
            다음 문장 →
          </button>
        </div>
      )}

      {step === "PLAYBACK_BACK" && (
        <div className="focusCard">
          <p className="stepDesc">{stepDesc}</p>
          {draft.interpUri ? <audio src={draft.interpUri} controls /> : <p className="errorText">녹음이 없습니다. 이전 단계로 돌아가세요.</p>}
          <p className="subLabel">준비되면 재통역을 녹음하세요</p>
          {stt.isListening && stt.transcript && (
            <div className="liveTranscript">
              <p>{stt.transcript}</p>
            </div>
          )}
          {recorder.recording && <span className="recordTimer">{recorder.formattedElapsed}</span>}
          <button className={recorder.recording ? "recordAction recording" : "recordAction"} onClick={() => record("back")} aria-label={recorder.recording ? "탭하여 완료" : "탭하여 녹음 시작"}>
            <span aria-hidden="true">{recorder.recording ? "■" : "●"}</span>
          </button>
          {stt.status && <p className="hint">{stt.status}</p>}
          <span className="recordLabel">{recorder.recording ? "탭하여 완료" : "탭하여 녹음 시작"}</span>
        </div>
      )}

      {step === "COMPARE" && (
        <div className="compareStack">
          {(draft.interpUri || draft.backUri) && (
            <div className="replaySection">
              {draft.interpUri && (
                <div className="replayItem">
                  <span>통역 녹음</span>
                  <audio src={draft.interpUri} controls />
                </div>
              )}
              {draft.backUri && (
                <div className="replayItem">
                  <span>재통역 녹음</span>
                  <audio src={draft.backUri} controls />
                </div>
              )}
            </div>
          )}
          <div className="compareBox"><span>원문 ({LANG_LABEL[srcLang]})</span><p>{originalText}</p></div>
          {modelText && <div className="compareBox blue"><span>통역 예시 ({LANG_LABEL[tgtLang]})</span><p>{modelText}</p></div>}
          <div className="compareBox amber">
            <span>내 재통역 ({LANG_LABEL[srcLang]})</span>
            <textarea value={draft.backText} onChange={(e) => setDraft({ ...draft, backText: e.target.value })} placeholder="STT 미인식 — 직접 입력" />
          </div>
          <textarea className="notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="학습 메모를 입력하세요..." />
          <div className="reviewSection">
            <p>이 문장 얼마나 어려웠나요?</p>
            <div className="difficultyRow">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button key={option.difficulty} onClick={() => onFinish(option.difficulty)}>
                  <strong>{option.label}</strong>
                  <small>{option.difficulty === 3 ? option.sublabel : `${daysPreview[option.difficulty]}일 후`}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="ghost" onClick={() => {
            // Bug 2: pass 2 should retry from PLAYBACK_BACK, not LISTEN_RECORD
            if (isReviewPass) {
              setDraft({ interpUri: draft.interpUri, backUri: "", backText: "", notes: draft.notes });
              setStep("PLAYBACK_BACK");
            } else {
              setDraft({ interpUri: "", backUri: "", backText: "", notes: "" });
              setStep("LISTEN_RECORD");
            }
          }}>
            다시 연습
          </button>
        </div>
      )}
    </section>
  );
}

const WEEK_DAYS = ["월", "", "수", "", "금", "", "일"];
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function heatmapColor(count: number): string {
  if (count === 0) return "#F3F4F6";
  if (count === 1) return "#BFDBFE";
  if (count <= 3) return "#60A5FA";
  return "#1A56DB";
}

function Heatmap({ data, weeks = 12 }: { data: Record<string, number>; weeks?: number }) {
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayDow - (weeks - 1) * 7);

  let prevMonth = -1;
  const columns = Array.from({ length: weeks }, (_, weekIndex) => {
    let monthLabel: string | null = null;
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + weekIndex * 7 + dayIndex);
      const month = date.getMonth();
      if (month !== prevMonth) {
        if (!monthLabel) monthLabel = MONTH_NAMES[month];
        prevMonth = month;
      }
      const key = toLocalDateString(date);
      return { key, count: data[key] ?? 0 };
    });
    return { monthLabel, days };
  });

  return (
    <div className="heatmap">
      <div className="heatmapMonths">
        <span />
        {columns.map((column, index) => <span key={index}>{column.monthLabel}</span>)}
      </div>
      <div className="heatmapGrid">
        <div className="heatmapDow">
          {WEEK_DAYS.map((label, index) => <span key={index}>{label}</span>)}
        </div>
        {columns.map((column, weekIndex) => (
          <div className="heatmapWeek" key={weekIndex}>
            {column.days.map((day) => (
              <span key={day.key} title={`${day.key}: ${day.count}개`} style={{ backgroundColor: heatmapColor(day.count) }} />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmapLegend">
        <span>적음</span>
        {[0, 1, 2, 4].map((count) => <i key={count} style={{ backgroundColor: heatmapColor(count) }} />)}
        <span>많음</span>
      </div>
    </div>
  );
}

function StepMark({ label, number, active, done }: { label: string; number: number; active: boolean; done: boolean }) {
  return (
    <div className="stepWrap">
      <span className={active ? "stepCircle active" : done ? "stepCircle done" : "stepCircle"}>{done ? "✓" : number}</span>
      <small className={active ? "active" : ""}>{label}</small>
    </div>
  );
}

function LibraryView({ settings, sentences, refresh, startSingle }: {
  settings: UserSettings;
  sentences: SentenceEntry[];
  refresh: () => Promise<void>;
  startSingle: (item: QueueItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterDiff, setFilterDiff] = useState<1 | 2 | 3 | null>(null);
  const [filterCat, setFilterCat] = useState<Category | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftDiff, setDraftDiff] = useState<1 | 2 | 3 | null>(null);
  const [draftCat, setDraftCat] = useState<Category | null>(null);
  const [draftTag, setDraftTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<SentenceEntry | null>(null);

  const allTags = useMemo(() => Array.from(new Set(sentences.flatMap((sentence) => sentence.tags))).sort(), [sentences]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sentences.filter((sentence) => {
      if (filterDiff && sentence.difficulty !== filterDiff) return false;
      if (filterCat && sentence.category !== filterCat) return false;
      if (filterTag && !sentence.tags.includes(filterTag)) return false;
      if (!q) return true;
      return [sentencePrimaryText(sentence), sentence.koreanText, sentence.japaneseText, sentence.chineseText, sentence.notes].join(" ").toLowerCase().includes(q);
    });
  }, [sentences, query, filterDiff, filterCat, filterTag]);
  const activeFilterCount = (filterDiff ? 1 : 0) + (filterCat ? 1 : 0) + (filterTag ? 1 : 0);
  const isFiltered = Boolean(query || activeFilterCount > 0);

  function openFilterModal() {
    setDraftDiff(filterDiff);
    setDraftCat(filterCat);
    setDraftTag(filterTag);
    setFilterModalVisible(true);
  }

  function applyFilter() {
    setFilterDiff(draftDiff);
    setFilterCat(draftCat);
    setFilterTag(draftTag);
    setFilterModalVisible(false);
  }

  function resetFilterDraft() {
    setDraftDiff(null);
    setDraftCat(null);
    setDraftTag(null);
  }

  function clearFilters() {
    setFilterDiff(null);
    setFilterCat(null);
    setFilterTag(null);
  }
  const editSentence = useCallback((sentence: SentenceEntry) => {
    setEditing(sentence);
  }, []);

  return (
    <section className="screen">
      <header className="libraryToolbar">
        <h1>{isFiltered ? `${filtered.length} / ${sentences.length}개` : `${sentences.length}개 문장`}</h1>
        <div className="toolbarRight">
          <button className="filterBtn" onClick={openFilterModal}>
            필터
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <button className="primary" onClick={() => setEditing(blankSentence(settings.foreignLanguage))}>+ 추가</button>
        </div>
      </header>

      <div className="searchBox">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="통합 검색" />
        {query.length > 0 && <button aria-label="검색어 지우기" onClick={() => setQuery("")}>×</button>}
      </div>

      {activeFilterCount > 0 && (
        <div className="activeSummary">
          {filterDiff && <span className="activeChip">{"★".repeat(filterDiff) + "☆".repeat(3 - filterDiff)}</span>}
          {filterCat && <span className="activeChip">{CATEGORIES.find((category) => category.key === filterCat)?.label}</span>}
          {filterTag && <span className="activeChip">{filterTag}</span>}
          <button onClick={clearFilters}>전체 해제</button>
        </div>
      )}

      {sentences.length === 0 ? (
        <div className="empty"><strong>📂 문장이 없습니다</strong><span>설정에서 구글 시트를 동기화하거나 직접 추가해보세요.</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty"><strong>🔍 검색 결과 없음</strong><span>다른 검색어나 필터를 시도해보세요.</span></div>
      ) : (
        <div className="listStack">
          {filtered.map((sentence) => (
            <LibraryListItem
              key={sentence.id}
              sentence={sentence}
              onEdit={editSentence}
            />
          ))}
        </div>
      )}
      {filterModalVisible && (
        <div className="sheetModal" role="dialog" aria-modal="true">
          <button className="sheetOverlay" aria-label="필터 닫기" onClick={() => setFilterModalVisible(false)} />
          <div className="sheet">
            <div className="sheetHandle" />
            <div className="sheetHeader">
              <h2>필터</h2>
              <button onClick={resetFilterDraft}>초기화</button>
            </div>
            <div className="sheetBody">
              <h3>난이도</h3>
              <div className="chips">
                <button className={draftDiff === null ? "chip active" : "chip"} onClick={() => setDraftDiff(null)}>전체</button>
                {DIFFICULTIES.map((difficulty) => (
                  <button
                    key={difficulty.value}
                    className={draftDiff === difficulty.value ? "chip active" : "chip"}
                    onClick={() => setDraftDiff(draftDiff === difficulty.value ? null : difficulty.value)}
                  >
                    {difficulty.label}
                  </button>
                ))}
              </div>

              <h3>카테고리</h3>
              <div className="chips">
                <button className={draftCat === null ? "chip active" : "chip"} onClick={() => setDraftCat(null)}>전체</button>
                {CATEGORIES.map((category) => (
                  <button
                    key={category.key}
                    className={draftCat === category.key ? "chip active" : "chip"}
                    onClick={() => setDraftCat(draftCat === category.key ? null : category.key)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {allTags.length > 0 && (
                <>
                  <h3>태그</h3>
                  <div className="chips">
                    <button className={draftTag === null ? "chip active" : "chip"} onClick={() => setDraftTag(null)}>전체</button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        className={draftTag === tag ? "chip active" : "chip"}
                        onClick={() => setDraftTag(draftTag === tag ? null : tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="applyBtn" onClick={applyFilter}>적용하기</button>
          </div>
        </div>
      )}
      {editing && <SentenceEditor settings={settings} sentence={editing} startSingle={startSingle} onClose={() => setEditing(null)} onSaved={refresh} />}
    </section>
  );
}

function blankSentence(foreignLanguage: ForeignLanguage): SentenceEntry {
  return {
    id: newId(),
    category: "daily",
    difficulty: 2,
    foreignLanguage,
    englishText: "",
    tags: [],
  };
}

const LibraryListItem = memo(function LibraryListItem({ sentence, onEdit }: {
  sentence: SentenceEntry;
  onEdit: (sentence: SentenceEntry) => void;
}) {
  return (
    <article className="listItem">
      <button className="listItemMain" onClick={() => onEdit(sentence)}>
        <div className="listText">
          <div className="badges">
            <span>{CATEGORY_LABELS[sentence.category]}</span>
            {sentence.koreanText && <span>양방향</span>}
            {sentence.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
            {sentence.tags.length > 3 && <span>+{sentence.tags.length - 3}</span>}
          </div>
          <h3>{sentencePrimaryText(sentence)}</h3>
          {sentence.koreanText && <p>{sentence.koreanText}</p>}
        </div>
        <div className="listMeta">
          <span className="stars">{"★".repeat(sentence.difficulty) + "☆".repeat(3 - sentence.difficulty)}</span>
          <span>›</span>
        </div>
      </button>
    </article>
  );
});

function SentenceEditor({ settings, sentence, startSingle, onClose, onSaved }: {
  settings: UserSettings;
  sentence: SentenceEntry;
  startSingle: (item: QueueItem) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<SentenceEntry>(sentence);
  const recorder = useRecorder();
  const [recordingKey, setRecordingKey] = useState<"primary" | "korean" | null>(null);
  const primaryKey = draft.foreignLanguage === "ja" ? "japaneseText" : draft.foreignLanguage === "zh" ? "chineseText" : "englishText";
  const primaryAudioKey = draft.foreignLanguage === "ja" ? "japaneseAudio" : draft.foreignLanguage === "zh" ? "chineseAudio" : "englishAudio";
  const primaryLabel = draft.foreignLanguage === "ja" ? "일본어 원문" : draft.foreignLanguage === "zh" ? "중국어 원문" : "영어 원문";
  const primaryLanguage = draft.foreignLanguage === "ja" ? "ja-JP" : draft.foreignLanguage === "zh" ? "zh-CN" : "en-US";
  const modelForeignKey = foreignModelKey(draft.foreignLanguage);

  async function save() {
    if (!sentencePrimaryText(draft).trim()) {
      alert(`${primaryLabel}을 입력해주세요.`);
      return;
    }
    await api.upsertSentence({ ...draft, tags: draft.tags.map((tag) => tag.trim()).filter(Boolean) });
    await onSaved();
    onClose();
  }

  async function playEditorAudio(text: string | undefined, audio: SentenceEntry[typeof primaryAudioKey], language: string) {
    if (!text?.trim()) {
      alert("먼저 문장을 입력해주세요.");
      return;
    }
    if (audio?.type === "file") {
      await playAudioUri(audio.uri);
      return;
    }
    await api.speakText(text, language, settings.playbackSpeed);
  }

  async function toggleRecording(target: "primary" | "korean") {
    const audioKey = target === "primary" ? primaryAudioKey : "koreanAudio";
    if (recorder.recording) {
      if (recordingKey !== target) {
        alert("현재 녹음을 먼저 완료해주세요.");
        return;
      }
      const uri = await recorder.stop();
      setDraft((current) => ({ ...current, [audioKey]: { type: "file", uri } }));
      setRecordingKey(null);
      return;
    }
    setRecordingKey(target);
    await recorder.start();
  }

  function resetToTTS(target: "primary" | "korean") {
    const audioKey = target === "primary" ? primaryAudioKey : "koreanAudio";
    setDraft((current) => ({ ...current, [audioKey]: { type: "tts" } }));
  }

  return (
    <div className="modalBackdrop">
      <div className="modal">
        <header><h2>{sentence.id.startsWith("custom_") ? "새 문장 추가" : "문장 편집"}</h2><button className="ghost" onClick={onClose}>닫기</button></header>
        <label>카테고리
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
            {CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
        </label>
        <label>초기 난이도
          <select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) as 1 | 2 | 3 })}>
            {DIFFICULTIES.map((difficulty) => <option key={difficulty.value} value={difficulty.value}>{difficulty.label}</option>)}
          </select>
          <span className="hint">연습 후 자동으로 업데이트됩니다</span>
        </label>
        <label><span className="labelText">{primaryLabel} <span className="required">*</span></span>
          <textarea value={(draft[primaryKey] as string | undefined) ?? ""} onChange={(e) => setDraft({ ...draft, [primaryKey]: e.target.value })} placeholder={`${primaryLabel}을 입력하세요`} />
        </label>
        <div className="audioEditor">
          <div>
            <strong>{primaryLabel} 음성</strong>
            <span>{draft[primaryAudioKey]?.type === "file" ? "녹음 파일 사용 중" : "TTS 사용 중"}</span>
          </div>
          <button onClick={() => playEditorAudio(draft[primaryKey] as string | undefined, draft[primaryAudioKey], primaryLanguage)}>듣기</button>
          <button className={recordingKey === "primary" ? "danger" : "secondary"} onClick={() => toggleRecording("primary")}>
            {recordingKey === "primary" ? "녹음 완료" : "녹음"}
          </button>
          <button className="ghost" onClick={() => resetToTTS("primary")}>TTS 사용</button>
        </div>
        <label><span className="labelText">한국어 원문 <span className="optional">(선택 — {koreanPracticeDescription(draft.foreignLanguage)})</span></span>
          <textarea value={draft.koreanText ?? ""} onChange={(e) => setDraft({ ...draft, koreanText: e.target.value })} placeholder="한국어 문장을 입력하세요" />
        </label>
        <div className="audioEditor">
          <div>
            <strong>한국어 원문 음성</strong>
            <span>{draft.koreanAudio?.type === "file" ? "녹음 파일 사용 중" : "TTS 사용 중"}</span>
          </div>
          <button onClick={() => playEditorAudio(draft.koreanText, draft.koreanAudio, "ko-KR")}>듣기</button>
          <button className={recordingKey === "korean" ? "danger" : "secondary"} onClick={() => toggleRecording("korean")}>
            {recordingKey === "korean" ? "녹음 완료" : "녹음"}
          </button>
          <button className="ghost" onClick={() => resetToTTS("korean")}>TTS 사용</button>
        </div>
        <label><span className="labelText">통역 예시 — 한국어 <span className="optional">({koreanDirectionLabel(draft.foreignLanguage)})</span></span>
          <textarea value={draft.modelKorean ?? ""} onChange={(e) => setDraft({ ...draft, modelKorean: e.target.value })} placeholder="비워두면 한국어 원문이 표시됨. 다르게 통역하고 싶을 때만 입력." />
        </label>
        <label><span className="labelText">{foreignModelLabel(draft.foreignLanguage)} <span className="optional">({foreignModelDirectionLabel(draft.foreignLanguage)})</span></span>
          <textarea
            value={(draft[modelForeignKey] as string | undefined) ?? ""}
            onChange={(e) => setDraft({ ...draft, [modelForeignKey]: e.target.value })}
            placeholder={`비워두면 ${primaryLabel}이 표시됨. 다르게 통역하고 싶을 때만 입력.`}
          />
        </label>
        <label><span className="labelText">태그 <span className="optional">(쉼표로 구분)</span></span>
          <input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((t) => t.trim()) })} placeholder="예: idiom, passive, business" />
        </label>
        <label>학습 메모
          <textarea value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="주의할 표현, 자주 틀리는 부분 등..." />
        </label>
        <div className="modalActions">
          <button className="primary" onClick={save}>{sentence.id.startsWith("custom_") ? "추가하기" : "저장하기"}</button>
          <button className="secondary" onClick={() => startSinglePractice(draft)}>연습하기</button>
          <button className="dangerText" onClick={async () => { await api.deleteSentence(draft.id); await onSaved(); onClose(); }}>문장 삭제</button>
        </div>
      </div>
    </div>
  );

  function startSinglePractice(entry: SentenceEntry) {
    const dirs = FOREIGN_LANGUAGE_DIRECTIONS[entry.foreignLanguage];
    const direction = entry.koreanText?.trim() && window.confirm(`${DIRECTION_LABELS[dirs[1]]} 방향으로 연습할까요?\n취소를 누르면 ${DIRECTION_LABELS[dirs[0]]} 방향으로 시작합니다.`)
      ? dirs[1]
      : dirs[0];
    startSingle({ sentence: entry, direction });
    onClose();
  }
}

function HistoryView({ results, sentences, refresh }: { results: SessionResult[]; sentences: SentenceEntry[]; refresh: () => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sentenceMap = useMemo(() => new Map(sentences.map((sentence) => [sentence.id, sentence])), [sentences]);
  useEffect(() => { refresh(); }, []);

  if (results.length === 0) {
    return <section className="screen"><div className="empty"><strong>📋 아직 학습 기록이 없어요</strong><span>연습을 완료하면 여기에 기록됩니다.</span></div></section>;
  }

  return (
    <section className="screen">
      <header className="toolbar"><h1>히스토리 <small>{results.length}</small></h1></header>
      <div className="listStack">
        {results.map((result) => {
          const sentence = sentenceMap.get(result.sentenceId);
          const isExpanded = expanded === result.id;
          return (
            <article className={isExpanded ? "listItem expandedItem" : "listItem"} key={result.id}>
              <button className="listItemMain" onClick={() => setExpanded(isExpanded ? null : result.id)}>
                <div className="listText">
                  <div className="badges">
                    <span>{DIRECTION_LABELS[result.direction]}</span>
                    {sentence && <span>{CATEGORY_LABELS[sentence.category]}</span>}
                  </div>
                  <h3>{result.originalText}</h3>
                </div>
                <div className="listMeta">
                  <span>{new Date(result.timestamp).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{isExpanded ? "⌃" : "⌄"}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="expanded">
                  {(result.interpRecordingUri || result.backInterpRecordingUri) && (
                    <div className="historyReplay">
                      {result.interpRecordingUri && (
                        <div>
                          <strong>통역 녹음</strong>
                          <audio src={result.interpRecordingUri} controls />
                        </div>
                      )}
                      {result.backInterpRecordingUri && (
                        <div>
                          <strong>재통역 녹음</strong>
                          <audio src={result.backInterpRecordingUri} controls />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="historyTextBlock">
                    <strong>내 재통역</strong>
                    <p>{result.backInterpText || "인식된 텍스트 없음"}</p>
                  </div>
                  {result.notes && (
                    <div className="historyTextBlock">
                      <strong>메모</strong>
                      <p className="notePreview">{result.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatSyncTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return d.getFullYear() === now.getFullYear() ? `${m}/${day} ${h}:${min}` : `${d.getFullYear()}/${m}/${day}`;
}

function SettingsView({ settings, setSettings, refresh, sentences }: {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  refresh: () => Promise<void>;
  sentences: SentenceEntry[];
}) {
  const [scriptUrl, setScriptUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastImportAt, setLastImportAt] = useState<number | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "latest" | "available" | "downloading" | "done">("idle");
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => { getVersion().then(setAppVersion); }, []);
  const [lastExportAt, setLastExportAt] = useState<number | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [limitInput, setLimitInput] = useState(String(settings.dailyNewLimit));
  const [customSpeedText, setCustomSpeedText] = useState(PRESET_SPEEDS.includes(settings.playbackSpeed) ? "" : String(settings.playbackSpeed));

  useEffect(() => {
    api.getStringSetting(SCRIPT_URL_KEY).then((v) => { if (v) setScriptUrl(v); });
    api.getStringSetting(LAST_IMPORT_KEY).then((v) => { if (v) setLastImportAt(Number(v)); });
    api.getStringSetting(LAST_EXPORT_KEY).then((v) => { if (v) setLastExportAt(Number(v)); });
  }, []);

  async function handleCheckUpdate() {
    setUpdateStatus("checking");
    try {
      const upd = await check();
      if (upd) {
        setPendingUpdate(upd);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("latest");
      }
    } catch {
      setUpdateStatus("idle");
    }
  }

  async function handleInstallUpdate() {
    if (!pendingUpdate) return;
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    try {
      let downloaded = 0;
      let total = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) setDownloadProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
          setUpdateStatus("done");
        }
      });
    } catch {
      setUpdateStatus("available");
    }
  }

  async function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    await api.setSetting(key, value);
    setSettings({ ...settings, [key]: value });
    await refresh();
  }

  function openSetupModal() {
    setModalUrl(scriptUrl);
    setSetupModalOpen(true);
  }

  async function saveAndCloseModal() {
    const url = modalUrl.trim();
    if (url) {
      await api.setStringSetting(SCRIPT_URL_KEY, url);
      setScriptUrl(url);
      setSyncMsg("URL이 저장됐습니다.");
      setTimeout(() => setSyncMsg(""), 2000);
    }
    setSetupModalOpen(false);
  }

  async function handleImport() {
    const url = scriptUrl.trim();
    if (!url) { alert("URL을 먼저 입력하세요."); return; }
    setImporting(true);
    setSyncMsg("");
    try {
      const { imported, failed } = await api.syncFromScript(url);
      const now = Date.now();
      await api.setStringSetting(LAST_IMPORT_KEY, String(now));
      setLastImportAt(now);
      await refresh();
      setSyncMsg(`${imported}개 문장 가져옴${failed > 0 ? `, ${failed}개 실패` : ""}`);
    } catch (e: unknown) {
      setSyncMsg(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    const url = scriptUrl.trim();
    if (!url) { alert("URL을 먼저 입력하세요."); return; }
    setExporting(true);
    setSyncMsg("");
    try {
      const count = await api.exportToScript(url);
      const now = Date.now();
      await api.setStringSetting(LAST_EXPORT_KEY, String(now));
      setLastExportAt(now);
      setSyncMsg(`${count}개 문장을 시트에 내보냈습니다.`);
    } catch (e: unknown) {
      setSyncMsg(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
    } finally {
      setExporting(false);
    }
  }

  function downloadCsv() {
    if (sentences.length === 0) {
      alert("내보낼 문장 없음\n라이브러리에 문장을 추가하세요.");
      return;
    }
    const blob = new Blob(["\uFEFF" + exportCSVContent(sentences)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentences_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyCustomLimit() {
    const value = Number.parseInt(limitInput, 10);
    if (!value || value < 1 || value > 999) {
      alert("올바른 숫자를 입력하세요 (1~999)");
      return;
    }
    update("dailyNewLimit", value);
  }

  function applyCustomSpeed() {
    const value = Number.parseFloat(customSpeedText);
    if (Number.isNaN(value) || value < 0.1 || value > 2) {
      alert("0.1 ~ 2.0 사이 숫자를 입력하세요");
      setCustomSpeedText("");
      return;
    }
    const rounded = Math.round(value * 100) / 100;
    update("playbackSpeed", rounded);
    setCustomSpeedText(String(rounded));
  }

  return (
    <>
    <section className="screen settings">
      <div className="group">
        <h2>양방향 동기화</h2>
        {!scriptUrl ? (
          <>
            <p>Google Apps Script를 통해 앱과 스프레드시트를 양방향으로 동기화합니다.</p>
            <button className="linkBtn" onClick={openSetupModal}>설정하기 →</button>
          </>
        ) : (
          <>
            <div className="syncActions">
              <div className="syncAction">
                <button className="primary" onClick={handleImport} disabled={importing}>
                  {importing ? "가져오는 중…" : "시트 → 앱으로 가져오기"}
                </button>
                {lastImportAt && <span className="hint">마지막 가져오기: {formatSyncTime(lastImportAt)}</span>}
              </div>
              <div className="syncAction">
                <button className="secondary" onClick={handleExport} disabled={exporting}>
                  {exporting ? "내보내는 중…" : "앱 → 시트로 내보내기"}
                </button>
                {lastExportAt && <span className="hint">마지막 내보내기: {formatSyncTime(lastExportAt)}</span>}
              </div>
            </div>
            {syncMsg && <span className="syncMsg">{syncMsg}</span>}
            <button className="linkBtn" onClick={openSetupModal}>설정 변경 →</button>
          </>
        )}
      </div>

      <div className="group">
        <h2>데이터 내보내기</h2>
        <p>문장과 학습 진도(복습 일정·횟수)를 CSV로 내보냅니다. 구글 드라이브에 저장해두면 폰을 바꿔도 구글 시트 동기화로 복원할 수 있습니다.</p>
        <button className="secondary" onClick={downloadCsv}>CSV 내보내기</button>
        <span className="hint">공유 창에서 구글 드라이브를 선택하세요</span>
      </div>

      <div className="group">
        <h2>연습 언어</h2>
        <p>선택한 언어쌍으로 라이브러리와 연습이 자동 전환됩니다.</p>
        <div className="chips">
          {(["en", "ja", "zh"] as ForeignLanguage[]).map((language) => (
            <button key={language} className={settings.foreignLanguage === language ? "chip active" : "chip"} onClick={() => update("foreignLanguage", language)}>
              {FOREIGN_LANGUAGE_LABELS[language]}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <h2>연습 설정</h2>
        <label className="settingRow"><span><strong>원문 텍스트 표시</strong><small>Step 1(듣기) 화면에서 원문 텍스트를 보여줍니다. OFF가 더 어렵고 효과적인 연습입니다.</small></span><input type="checkbox" checked={settings.showSourceTextDuringListen} onChange={(e) => update("showSourceTextDuringListen", e.target.checked)} /></label>
        <label className="settingRow"><span><strong>문장 순서 섞기</strong><small>ON이면 매번 무작위 순서로 학습합니다.</small></span><input type="checkbox" checked={settings.shuffleSentences} onChange={(e) => update("shuffleSentences", e.target.checked)} /></label>
        <label className="settingRow"><span><strong>분리 세션 모드</strong><small>통역을 모두 먼저 녹음한 뒤 재통역·비교를 순서대로 진행합니다.</small></span><input type="checkbox" checked={settings.splitSessionMode} onChange={(e) => update("splitSessionMode", e.target.checked)} /></label>
        <div>
          <strong>하루 새 문장 수</strong>
          <p>복습 문장 외에 추가할 새 문장의 최대 개수입니다.</p>
          <div className="chips">
            {PRESET_LIMITS.map((value) => <button key={value} className={settings.dailyNewLimit === value ? "chip active" : "chip"} onClick={() => update("dailyNewLimit", value)}>{value}개</button>)}
            <input className="inlineInput" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} onBlur={applyCustomLimit} />
          </div>
        </div>
      </div>

      <AudioDeviceSettings />

      <div className="group">
        <h2>TTS 재생 속도</h2>
        {SPEEDS.map((speed) => (
          <label key={speed.value} className="radioRow">
            <input type="radio" checked={settings.playbackSpeed === speed.value} onChange={() => { setCustomSpeedText(""); update("playbackSpeed", speed.value); }} />
            {speed.label}
          </label>
        ))}
        <label className="radioRow">
          <input type="radio" checked={!PRESET_SPEEDS.includes(settings.playbackSpeed)} readOnly />
          직접 입력
          <input className="speedInput" value={customSpeedText} onChange={(e) => setCustomSpeedText(e.target.value)} onBlur={applyCustomSpeed} placeholder="예: 0.6" />
          x
        </label>
        <span className="hint">0.1 ~ 2.0 범위로 입력</span>
      </div>

      <div className="group">
        <h2>정보</h2>
        <InfoRow label="버전" value={appVersion || "…"} />
        <InfoRow label="저장소" value="기기 로컬 (SQLite)" />
        <InfoRow label="오디오 엔진" value="eSpeak NG / XTTS-v2 어댑터" />
        <InfoRow label="음성 인식" value="Vosk 로컬 모델 (무료)" />
        <div className="updateSection">
          {updateStatus === "idle" && (
            <button className="secondary" onClick={handleCheckUpdate}>업데이트 확인</button>
          )}
          {updateStatus === "checking" && <span className="hint">확인 중…</span>}
          {updateStatus === "latest" && <span className="hint">✓ 최신 버전입니다</span>}
          {updateStatus === "available" && (
            <div className="updateAvailable">
              <span>v{pendingUpdate?.version} 업데이트가 있습니다</span>
              {pendingUpdate?.body && <small>{pendingUpdate.body}</small>}
              <button className="primary" onClick={handleInstallUpdate}>다운로드 및 설치</button>
            </div>
          )}
          {updateStatus === "downloading" && (
            <div className="updateProgress">
              <span>다운로드 중… {downloadProgress}%</span>
              <progress value={downloadProgress} max={100} />
            </div>
          )}
          {updateStatus === "done" && <span className="hint">✓ 설치 완료 — 앱이 재시작됩니다</span>}
        </div>
      </div>
    </section>
    {setupModalOpen && (
      <div className="modalBackdrop" onClick={() => setSetupModalOpen(false)}>
        <div className="modal syncSetupModal" onClick={(e) => e.stopPropagation()}>
          <div className="modalHeader">
            <h2>양방향 동기화 설정</h2>
            <button className="closeBtn" onClick={() => setSetupModalOpen(false)}>✕</button>
          </div>
          <p className="setupModalDesc">Google Apps Script를 통해 앱과 스프레드시트를 양방향으로 동기화합니다. 최초 설정 후에는 버튼 하나로 가져오기·내보내기가 가능합니다.</p>
          <ol className="syncSteps">
            {SYNC_STEPS.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <div className="codeBlock">
            <div className="codeHeader">
              <span>Apps Script 코드</span>
              <button onClick={() => navigator.clipboard.writeText(SCRIPT_CODE)}>복사</button>
            </div>
            <pre>{SCRIPT_CODE}</pre>
          </div>
          <div>
            <label className="setupUrlLabel">웹 앱 URL</label>
            <input
              value={modalUrl}
              onChange={(e) => setModalUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>
          <div className="modalActions">
            <button className="secondary" onClick={() => setSetupModalOpen(false)}>닫기</button>
            <button className="primary" onClick={saveAndCloseModal}>저장</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function AudioDeviceSettings() {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [status, setStatus] = useState("");
  const monitorRef = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);

  useEffect(() => {
    loadDevices();
    return stopMicTest;
  }, []);

  async function loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setStatus("이 환경에서는 오디오 장치 목록을 불러올 수 없습니다.");
      return;
    }
    const [savedMic, savedSpeaker] = await Promise.all([
      api.getStringSetting("microphoneDeviceId"),
      api.getStringSetting("speakerDeviceId"),
    ]);
    setSelectedMic(savedMic ?? "");
    setSelectedSpeaker(savedSpeaker ?? "");
    const devices = await navigator.mediaDevices.enumerateDevices();
    setMicrophones(devices.filter((device) => device.kind === "audioinput"));
    setSpeakers(devices.filter((device) => device.kind === "audiooutput"));
  }

  async function askPermissionAndReload() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await loadDevices();
      setStatus("마이크 권한 확인 완료");
    } catch (error) {
      setStatus(`마이크 권한 확인 실패: ${String(error)}`);
    }
  }

  async function saveMic(deviceId: string) {
    setSelectedMic(deviceId);
    await api.setStringSetting("microphoneDeviceId", deviceId);
  }

  async function saveSpeaker(deviceId: string) {
    setSelectedSpeaker(deviceId);
    await api.setStringSetting("speakerDeviceId", deviceId);
  }

  async function startMicTest() {
    try {
      stopMicTest();
      const constraints: MediaStreamConstraints = {
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((average / 180) * 100)));
        const current = monitorRef.current;
        if (current) current.frame = requestAnimationFrame(tick);
      };
      monitorRef.current = { stream, context, frame: requestAnimationFrame(tick) };
      setMonitoring(true);
      setStatus("마이크 입력 테스트 중");
    } catch (error) {
      setStatus(`마이크 테스트 실패: ${String(error)}`);
      setMonitoring(false);
    }
  }

  function stopMicTest() {
    const current = monitorRef.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((track) => track.stop());
    current.context.close();
    monitorRef.current = null;
    setMonitoring(false);
    setMicLevel(0);
  }

  async function testSpeaker() {
    try {
      const audio = new Audio(makeTestToneUrl()) as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
      const canSelectSpeaker = typeof audio.setSinkId === "function";
      if (selectedSpeaker && canSelectSpeaker) await audio.setSinkId(selectedSpeaker);
      await audio.play();
      setStatus(canSelectSpeaker ? "스피커 테스트 재생 중" : "기본 스피커로 테스트 재생 중");
    } catch (error) {
      setStatus(`스피커 테스트 실패: ${String(error)}`);
    }
  }

  return (
    <div className="group">
      <h2>오디오 장치</h2>
      <p>마이크와 스피커를 선택하고 연습 전에 입력/출력을 확인합니다.</p>
      <div className="deviceGrid">
        <label>마이크
          <select value={selectedMic} onChange={(e) => saveMic(e.target.value)}>
            <option value="">시스템 기본 마이크</option>
            {microphones.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `마이크 ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>스피커
          <select value={selectedSpeaker} onChange={(e) => saveSpeaker(e.target.value)}>
            <option value="">시스템 기본 스피커</option>
            {speakers.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `스피커 ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="audioTestRow">
        <button className="secondary" onClick={askPermissionAndReload}>장치 새로고침</button>
        <button className={monitoring ? "danger" : "secondary"} onClick={monitoring ? stopMicTest : startMicTest}>
          {monitoring ? "마이크 테스트 중지" : "마이크 테스트"}
        </button>
        <button className="secondary" onClick={testSpeaker}>스피커 테스트</button>
      </div>
      <div className="micMeter" aria-label="마이크 입력 레벨">
        <span style={{ width: `${micLevel}%` }} />
      </div>
      {status && <span className="hint">{status}</span>}
    </div>
  );
}

function makeTestToneUrl() {
  const sampleRate = 44100;
  const duration = 0.45;
  const length = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i += 1) {
    const fade = Math.min(1, i / 1200, (length - i) / 1200);
    const sample = Math.sin((i / sampleRate) * Math.PI * 2 * 880) * 0.28 * fade;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="infoRow"><span>{label}</span><strong>{value}</strong></div>;
}

function useLiveSTT(language: string, onEnd?: (text: string) => void) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const accumulatedRef = useRef("");
  const currentFinalRef = useRef("");
  const lastInterimRef = useRef("");
  const activeRef = useRef(false);
  const stoppingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const getFullText = () => [accumulatedRef.current, currentFinalRef.current].filter(Boolean).join(" ");
  const publish = () => {
    setTranscript([accumulatedRef.current, currentFinalRef.current, lastInterimRef.current].filter(Boolean).join(" "));
  };

  function SpeechCtor() {
    return (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition ?? (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).webkitSpeechRecognition;
  }

  function cleanupRecognition() {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try { recognition.abort(); } catch { /* noop */ }
    }
    recognitionRef.current = null;
  }

  function startEngine() {
    const Ctor = SpeechCtor();
    if (!Ctor) {
      setStatus("이 환경에서는 실시간 STT를 지원하지 않습니다. 직접 입력을 사용하세요.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      setIsListening(true);
      setStatus("실시간 음성 인식 중");
      currentFinalRef.current = "";
      lastInterimRef.current = "";
      publish();
    };
    recognition.onresult = (event) => {
      let finalSegment = "";
      let interimSegment = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) finalSegment = [finalSegment, text].filter(Boolean).join(" ");
        else interimSegment = [interimSegment, text].filter(Boolean).join(" ");
      }
      if (finalSegment) {
        currentFinalRef.current = [currentFinalRef.current, finalSegment].filter(Boolean).join(" ");
        lastInterimRef.current = "";
      } else {
        lastInterimRef.current = interimSegment;
      }
      publish();
    };
    recognition.onerror = (event) => {
      setStatus(event.error ? `STT 오류: ${event.error}` : "STT 오류가 발생했습니다.");
      setIsListening(false);
      if (activeRef.current && !stoppingRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          if (activeRef.current && !stoppingRef.current) startEngine();
        }, 500);
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      const segment = currentFinalRef.current || lastInterimRef.current;
      if (activeRef.current && !stoppingRef.current) {
        accumulatedRef.current = [accumulatedRef.current, segment].filter(Boolean).join(" ");
        currentFinalRef.current = "";
        lastInterimRef.current = "";
        publish();
        restartTimerRef.current = window.setTimeout(() => {
          if (activeRef.current && !stoppingRef.current) startEngine();
        }, 150);
      } else {
        activeRef.current = false;
        stoppingRef.current = false;
        const finalText = [accumulatedRef.current, segment].filter(Boolean).join(" ").trim();
        setTranscript(finalText);
        onEndRef.current?.(finalText);
        setStatus(finalText ? "STT 기록 완료" : "STT 미인식 — 직접 입력");
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus("STT 시작 실패. 잠시 후 다시 시도하세요.");
    }
  }

  async function startListening() {
    cleanupRecognition();
    accumulatedRef.current = "";
    currentFinalRef.current = "";
    lastInterimRef.current = "";
    activeRef.current = true;
    stoppingRef.current = false;
    setTranscript("");
    setStatus("마이크 권한 확인 중...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setStatus("마이크 접근이 거부되었습니다. Windows 설정 → 개인 정보 보호 → 마이크에서 이 앱을 허용해주세요.");
      activeRef.current = false;
      return;
    }
    startEngine();
  }

  function stopListening() {
    activeRef.current = false;
    stoppingRef.current = true;
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { onEndRef.current?.(getFullText().trim()); }
    } else {
      const finalText = getFullText().trim();
      setTranscript(finalText);
      onEndRef.current?.(finalText);
    }
  }

  useEffect(() => cleanupRecognition, []);

  return { transcript, isListening, status, startListening, stopListening };
}

function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  async function start() {
    const microphoneDeviceId = await api.getStringSetting("microphoneDeviceId");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true,
    });
    chunks.current = [];
    recorderRef.current = new MediaRecorder(stream);
    recorderRef.current.ondataavailable = (event) => chunks.current.push(event.data);
    recorderRef.current.start();
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    setRecording(true);
  }

  async function stop(): Promise<string> {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve("");
        return;
      }
      recorder.onstop = () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);
        setElapsed(0);
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve(URL.createObjectURL(new Blob(chunks.current, { type: "audio/webm" })));
      };
      recorder.stop();
    });
  }

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  const formattedElapsed = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return { recording, elapsed, formattedElapsed, start, stop };
}

export default App;
