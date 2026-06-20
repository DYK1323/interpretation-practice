import type { Category, ForeignLanguage, SentenceEntry } from "./types";
import { stableId } from "./session";

export const CSV_HEADERS = [
  "id", "category", "difficulty", "foreignLanguage",
  "sourceText", "koreanText",
  "sourceAudioType", "sourceAudioUri",
  "koreanAudioType", "koreanAudioUri",
  "modelKorean", "modelSource",
  "tags", "notes",
  "fwdNextReviewDate", "fwdIntervalDays", "fwdReviewCount", "fwdLastStudiedAt",
  "bwdNextReviewDate", "bwdIntervalDays", "bwdReviewCount", "bwdLastStudiedAt",
] as const;

export interface ParsedCSV {
  rows: Array<{ entry: SentenceEntry; raw: Record<string, string> }>;
  failed: number;
  keepDifficulty: boolean;
  hasProgress: boolean;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function escapeCSV(value: string | number | undefined | null): string {
  const s = String(value ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function recordFrom(cols: string[], headers: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, cols[index]?.trim() ?? ""]));
}

function audio(type: string, uri: string) {
  return type === "file" ? { type: "file" as const, uri } : { type: "tts" as const };
}

export function rowToEntry(raw: Record<string, string>): SentenceEntry | null {
  const sourceText = raw.sourceText || raw.englishText;
  if (!sourceText) return null;

  const foreignLanguage = (["en", "ja", "zh"].includes(raw.foreignLanguage)
    ? raw.foreignLanguage
    : "en") as ForeignLanguage;
  const difficultyRaw = Number.parseInt(raw.difficulty, 10);
  const difficulty = ([1, 2, 3].includes(difficultyRaw) ? difficultyRaw : 1) as 1 | 2 | 3;
  const tags = raw.tags
    ? raw.tags.includes("|")
      ? raw.tags.split("|").map((tag) => tag.trim()).filter(Boolean)
      : raw.tags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean)
    : [];
  const sourceAudio = audio(raw.sourceAudioType || raw.englishAudioType || "tts", raw.sourceAudioUri || raw.englishAudioUri || "");
  const koreanAudio = audio(raw.koreanAudioType || "tts", raw.koreanAudioUri || "");
  const modelSource = raw.modelSource || raw.modelEnglish || undefined;

  return {
    id: raw.id || stableId(sourceText),
    category: (raw.category as Category) || "daily",
    difficulty,
    foreignLanguage,
    englishText: foreignLanguage === "en" ? sourceText : "",
    koreanText: raw.koreanText || undefined,
    englishAudio: foreignLanguage === "en" ? sourceAudio : { type: "tts" },
    koreanAudio,
    japaneseText: foreignLanguage === "ja" ? sourceText : undefined,
    japaneseAudio: foreignLanguage === "ja" ? sourceAudio : { type: "tts" },
    chineseText: foreignLanguage === "zh" ? sourceText : undefined,
    chineseAudio: foreignLanguage === "zh" ? sourceAudio : { type: "tts" },
    modelKorean: raw.modelKorean || undefined,
    modelEnglish: foreignLanguage === "en" ? modelSource : undefined,
    modelJapanese: foreignLanguage === "ja" ? modelSource : undefined,
    modelChinese: foreignLanguage === "zh" ? modelSource : undefined,
    tags,
    notes: raw.notes || undefined,
  };
}

export function parseCSVContent(content: string): ParsedCSV {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], failed: 0, keepDifficulty: true, hasProgress: false };
  const headers = parseCSVLine(lines[0]);
  if (!headers.includes("sourceText") && !headers.includes("englishText")) {
    throw new Error("필수 컬럼 sourceText 또는 legacy englishText가 필요합니다.");
  }
  const rows: ParsedCSV["rows"] = [];
  let failed = 0;
  for (const line of lines.slice(1)) {
    const raw = recordFrom(parseCSVLine(line), headers);
    const entry = rowToEntry(raw);
    if (entry) rows.push({ entry, raw });
    else failed += 1;
  }
  return {
    rows,
    failed,
    keepDifficulty: !headers.includes("difficulty"),
    hasProgress: ["fwdNextReviewDate", "bwdNextReviewDate", "enkoNextReviewDate", "koenNextReviewDate"].some((h) => headers.includes(h)),
  };
}

export function toCSVExportUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv` : url.trim();
}

export function sentenceToCSV(row: SentenceEntry, progress: Record<string, string | number | null> = {}): string {
  const fl = row.foreignLanguage ?? "en";
  const sourceText = fl === "ja" ? row.japaneseText ?? "" : fl === "zh" ? row.chineseText ?? "" : row.englishText;
  const sourceAudio = fl === "ja" ? row.japaneseAudio : fl === "zh" ? row.chineseAudio : row.englishAudio;
  const modelSource = fl === "ja" ? row.modelJapanese : fl === "zh" ? row.modelChinese : row.modelEnglish;
  const values = [
    row.id, row.category, row.difficulty, fl,
    sourceText, row.koreanText ?? "",
    sourceAudio?.type ?? "tts", sourceAudio?.type === "file" ? sourceAudio.uri : "",
    row.koreanAudio?.type ?? "tts", row.koreanAudio?.type === "file" ? row.koreanAudio.uri : "",
    row.modelKorean ?? "", modelSource ?? "",
    row.tags.join("|"), row.notes ?? "",
    progress.fwdNextReviewDate, progress.fwdIntervalDays, progress.fwdReviewCount, progress.fwdLastStudiedAt,
    progress.bwdNextReviewDate, progress.bwdIntervalDays, progress.bwdReviewCount, progress.bwdLastStudiedAt,
  ];
  return values.map(escapeCSV).join(",");
}

export function exportCSVContent(rows: SentenceEntry[]): string {
  return [CSV_HEADERS.join(","), ...rows.map((row) => sentenceToCSV(row))].join("\n");
}
