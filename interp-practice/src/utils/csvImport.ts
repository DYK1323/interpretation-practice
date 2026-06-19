import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { upsertSentence } from "../db/sentences";
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

function rowToEntry(cols: string[], headers: string[]): SentenceEntry | null {
  const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";

  const id = get("id");
  const englishText = get("englishText");
  if (!id || !englishText) return null;

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
  let imported = 0;
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const entry = rowToEntry(cols, headers);
    if (entry) {
      try {
        await upsertSentence(entry);
        imported++;
      } catch {
        failed++;
      }
    } else {
      failed++;
    }
  }

  return { imported, failed };
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
