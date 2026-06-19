import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { getDB } from "../db/schema";
import type { SentenceEntry, Category } from "../types";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

function stableId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return "auto_" + Math.abs(hash).toString(16).padStart(8, "0");
}

function rowToEntry(cols: string[], headers: string[]): SentenceEntry | null {
  const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";

  const englishText = get("englishText");
  if (!englishText) return null;

  const id = get("id") || stableId(englishText);

  const tagsRaw = get("tags");
  const tags = tagsRaw
    ? tagsRaw.includes("|")
      ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
      : tagsRaw.split(/\s+/).filter(Boolean)
    : [];

  const koreanText = get("koreanText") || undefined;
  const modelKorean = get("modelKorean") || undefined;
  const modelEnglish = get("modelEnglish") || undefined;
  const enAudioType = get("englishAudioType") || "tts";
  const koAudioType = get("koreanAudioType") || "tts";

  const diffRaw = parseInt(get("difficulty"), 10);
  const difficulty = ([1, 2, 3].includes(diffRaw) ? diffRaw : 1) as 1 | 2 | 3;

  return {
    id,
    category: (get("category") as Category) || "daily",
    difficulty,
    englishText,
    koreanText,
    englishAudio: enAudioType === "file"
      ? { type: "file", uri: get("englishAudioUri") }
      : { type: "tts" },
    koreanAudio: koAudioType === "file"
      ? { type: "file", uri: get("koreanAudioUri") }
      : { type: "tts" },
    modelKorean,
    modelEnglish,
    tags,
    notes: get("notes") || undefined,
  };
}

async function importCSVContent(content: string): Promise<{ imported: number; failed: number }> {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, failed: 0 };

  const headers = parseCSVLine(lines[0]);
  const keepDifficulty = !headers.includes("difficulty");

  const entries: SentenceEntry[] = [];
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const entry = rowToEntry(cols, headers);
    if (entry) entries.push(entry);
    else failed++;
  }

  const db = await getDB();
  await db.withTransactionAsync(async () => {
    for (const e of entries) {
      const diffParam = keepDifficulty ? null : e.difficulty;
      await db.runAsync(
        `INSERT INTO sentences (
          id, category, difficulty, english_text, korean_text,
          english_audio_type, english_audio_uri,
          korean_audio_type, korean_audio_uri,
          model_korean, model_english, tags, duration_seconds, notes
        ) VALUES (?, ?, COALESCE(?, 2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          difficulty = COALESCE(excluded.difficulty, sentences.difficulty),
          english_text = excluded.english_text,
          korean_text = excluded.korean_text,
          english_audio_type = excluded.english_audio_type,
          english_audio_uri = excluded.english_audio_uri,
          korean_audio_type = excluded.korean_audio_type,
          korean_audio_uri = excluded.korean_audio_uri,
          model_korean = excluded.model_korean,
          model_english = excluded.model_english,
          tags = excluded.tags,
          duration_seconds = excluded.duration_seconds,
          notes = excluded.notes`,
        [
          e.id, e.category, diffParam, e.englishText, e.koreanText ?? null,
          e.englishAudio?.type ?? "tts",
          e.englishAudio?.type === "file" ? e.englishAudio.uri : null,
          e.koreanAudio?.type ?? "tts",
          e.koreanAudio?.type === "file" ? e.koreanAudio.uri : null,
          e.modelKorean ?? null, e.modelEnglish ?? null,
          JSON.stringify(e.tags), e.durationSeconds ?? null, e.notes ?? null,
        ]
      );
    }
  });

  return { imported: entries.length, failed };
}

export async function importCSV(): Promise<{ imported: number; failed: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { imported: 0, failed: 0 };
  }

  const content = await new File(result.assets[0].uri).text();
  return importCSVContent(content);
}

function toCSVExportUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }
  return url.trim();
}

export async function syncFromSheetUrl(rawUrl: string): Promise<{ imported: number; failed: number }> {
  const csvUrl = toCSVExportUrl(rawUrl);
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`시트 불러오기 실패 (HTTP ${response.status})`);
  const content = await response.text();
  return importCSVContent(content);
}
