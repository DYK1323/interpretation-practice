import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_SETTINGS,
  type Category,
  type Direction,
  type ForeignLanguage,
  type SentenceEntry,
  type SessionResult,
  type UserSettings,
} from "../core/types";
import { parseCSVContent, toCSVExportUrl, exportCSVContent } from "../core/csv";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface QueueItem {
  sentence: SentenceEntry;
  direction: Direction;
  intervalDays?: number;
}

const memory = {
  settings: { ...DEFAULT_SETTINGS } as UserSettings,
  strings: new Map<string, string>(),
  sentences: new Map<string, SentenceEntry>(),
  results: [] as SessionResult[],
  progress: new Map<string, { nextReviewDate: number; intervalDays: number; reviewCount: number; lastStudiedAt: number; firstStudiedAt: number }>(),
};

function seedMemory() {
  if (memory.sentences.size > 0) return;
  const samples: SentenceEntry[] = [
    {
      id: "sample_en_1",
      category: "daily",
      difficulty: 2,
      foreignLanguage: "en",
      englishText: "Could you walk me through the main points of today's briefing?",
      koreanText: "오늘 브리핑의 핵심 내용을 설명해 주시겠어요?",
      modelKorean: "오늘 브리핑의 주요 내용을 차근차근 설명해 주시겠어요?",
      modelEnglish: "Could you explain the main points of today's briefing?",
      tags: ["briefing", "daily"],
    },
    {
      id: "sample_ja_1",
      category: "business",
      difficulty: 2,
      foreignLanguage: "ja",
      englishText: "",
      japaneseText: "来週の会議までに資料を更新しておきます。",
      koreanText: "다음 주 회의 전까지 자료를 업데이트해 두겠습니다.",
      modelKorean: "다음 주 회의까지 자료를 최신 상태로 정리해 두겠습니다.",
      modelJapanese: "来週の会議までに資料を最新の状態にしておきます。",
      tags: ["meeting"],
    },
    {
      id: "sample_zh_1",
      category: "conference",
      difficulty: 3,
      foreignLanguage: "zh",
      englishText: "",
      chineseText: "我们需要在预算范围内完成这个项目。",
      koreanText: "우리는 예산 범위 안에서 이 프로젝트를 완료해야 합니다.",
      modelKorean: "이 프로젝트는 정해진 예산 안에서 마무리해야 합니다.",
      modelChinese: "我们必须在既定预算内完成这个项目。",
      tags: ["budget"],
    },
  ];
  samples.forEach((sentence) => memory.sentences.set(sentence.id, sentence));
}

seedMemory();

export async function initDB(): Promise<string> {
  if (isTauri) return invoke("init_db");
  return "browser-preview-memory";
}

export async function getAllSettings(): Promise<UserSettings> {
  if (isTauri) return invoke("get_all_settings");
  return { ...memory.settings };
}

export async function setSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): Promise<void> {
  if (isTauri) return invoke("set_setting", { key, value });
  memory.settings[key] = value as never;
}

export async function getStringSetting(key: string): Promise<string | null> {
  if (isTauri) return invoke("get_string_setting", { key });
  return memory.strings.get(key) ?? null;
}

export async function setStringSetting(key: string, value: string): Promise<void> {
  if (isTauri) return invoke("set_string_setting", { key, value });
  memory.strings.set(key, value);
}

export async function getAllSentences(foreignLanguage?: ForeignLanguage): Promise<SentenceEntry[]> {
  if (isTauri) return invoke("get_all_sentences", { foreignLanguage });
  return [...memory.sentences.values()]
    .filter((sentence) => !foreignLanguage || sentence.foreignLanguage === foreignLanguage)
    .sort((a, b) => a.category.localeCompare(b.category) || a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

export async function upsertSentence(entry: SentenceEntry): Promise<void> {
  if (isTauri) return invoke("upsert_sentence", { entry });
  memory.sentences.set(entry.id, entry);
}

export async function deleteSentence(id: string): Promise<void> {
  if (isTauri) return invoke("delete_sentence", { id });
  memory.sentences.delete(id);
}

export async function getPracticeQueue(
  foreignLanguage: ForeignLanguage,
  direction: Direction,
  category: Category | null,
  dailyNewLimit: number,
): Promise<QueueItem[]> {
  if (isTauri) return invoke("get_practice_queue", { foreignLanguage, direction, category, dailyNewLimit });
  const now = Date.now();
  const due = [...memory.progress.entries()]
    .filter(([, progress]) => progress.nextReviewDate <= now)
    .map(([key]) => {
      const [sentenceId, dir] = key.split(":") as [string, Direction];
      const sentence = memory.sentences.get(sentenceId);
      return sentence && sentence.foreignLanguage === foreignLanguage ? { sentence, direction: dir } : null;
    })
    .filter(Boolean) as QueueItem[];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newStudied = new Set([...memory.progress.entries()].filter(([, p]) => p.firstStudiedAt >= todayStart.getTime()).map(([key]) => key.split(":")[0])).size;
  const remaining = Math.max(0, dailyNewLimit - newStudied);
  const fresh = [...memory.sentences.values()]
    .filter((sentence) => sentence.foreignLanguage === foreignLanguage)
    .filter((sentence) => !category || sentence.category === category)
    .filter((sentence) => !memory.progress.has(`${sentence.id}:${direction}`))
    .filter((sentence) => !direction.startsWith("ko-") || Boolean(sentence.koreanText))
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    .slice(0, remaining)
    .map((sentence) => ({ sentence, direction }));
  return [...due, ...fresh];
}

export async function getProgress(sentenceId: string, direction: Direction): Promise<{ intervalDays: number } | null> {
  if (isTauri) return invoke("get_progress", { sentenceId, direction });
  const key = `${sentenceId}:${direction}`;
  const prog = memory.progress.get(key);
  return prog ? { intervalDays: prog.intervalDays } : null;
}

export async function scheduleReview(sentenceId: string, direction: Direction, intervalDays: number): Promise<void> {
  const now = Date.now();
  if (isTauri) return invoke("schedule_review", { sentenceId, direction, intervalDays, now });
  const key = `${sentenceId}:${direction}`;
  const previous = memory.progress.get(key);
  memory.progress.set(key, {
    nextReviewDate: now + intervalDays * 86_400_000,
    intervalDays,
    reviewCount: (previous?.reviewCount ?? 0) + 1,
    lastStudiedAt: now,
    firstStudiedAt: previous?.firstStudiedAt ?? now,
  });
}

export async function saveResult(result: SessionResult): Promise<void> {
  if (isTauri) return invoke("save_result", { result });
  memory.results = [result, ...memory.results.filter((item) => item.id !== result.id)];
}

export async function getResults(limit = 100): Promise<SessionResult[]> {
  if (isTauri) return invoke("get_results", { limit });
  return memory.results.slice(0, limit);
}

export async function importCSV(content: string): Promise<{ imported: number; failed: number }> {
  const parsed = parseCSVContent(content);
  for (const row of parsed.rows) {
    await upsertSentence(row.entry);
  }
  return { imported: parsed.rows.length, failed: parsed.failed };
}

export async function syncFromSheetUrl(rawUrl: string): Promise<{ imported: number; failed: number }> {
  const response = await fetch(toCSVExportUrl(rawUrl));
  if (!response.ok) throw new Error(`시트 불러오기 실패 (HTTP ${response.status})`);
  return importCSV(await response.text());
}

export async function syncFromScript(url: string): Promise<{ imported: number; failed: number }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`가져오기 실패 (HTTP ${response.status})`);
  return importCSV(await response.text());
}

export async function exportToScript(url: string): Promise<number> {
  const sentences = await getAllSentences();
  if (sentences.length === 0) throw new Error("내보낼 문장이 없습니다.");
  const csv = exportCSVContent(sentences);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: csv,
  });
  if (!response.ok) throw new Error(`내보내기 실패 (HTTP ${response.status})`);
  return sentences.length;
}

export async function getTodaySentences(foreignLanguage: ForeignLanguage): Promise<QueueItem[]> {
  if (isTauri) return invoke("get_today_sentences", { foreignLanguage });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seen = new Set<string>();
  return memory.results
    .filter((r) => r.timestamp >= today.getTime())
    .flatMap((r) => {
      const sentence = memory.sentences.get(r.sentenceId);
      if (!sentence || sentence.foreignLanguage !== foreignLanguage) return [];
      const key = `${r.sentenceId}:${r.direction}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ sentence, direction: r.direction as Direction }];
    });
}

export async function getNewSentences(
  foreignLanguage: ForeignLanguage,
  direction: Direction,
  category: Category | null,
  limit: number,
): Promise<QueueItem[]> {
  if (isTauri) return invoke("get_new_sentences", { foreignLanguage, direction, category, limit });
  return [...memory.sentences.values()]
    .filter((s) => s.foreignLanguage === foreignLanguage)
    .filter((s) => !category || s.category === category)
    .filter((s) => !memory.progress.has(`${s.id}:${direction}`))
    .filter((s) => !direction.startsWith("ko-") || Boolean(s.koreanText))
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((s) => ({ sentence: s, direction }));
}

export async function speakText(text: string, language: string, speed: number): Promise<void> {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
    return;
  }
  if (isTauri) await invoke("speak_text", { text, language, speed });
}

export async function startSTT(language: string): Promise<string> {
  if (isTauri) return invoke("start_stt", { language });
  return `브라우저 미리보기에서는 ${language} STT 대신 직접 입력을 사용합니다.`;
}
