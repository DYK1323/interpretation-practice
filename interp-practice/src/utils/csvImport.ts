import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { getDB } from "../db/schema";
import type { SentenceEntry, Category, ForeignLanguage } from "../types";

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
  const japaneseText = get("japaneseText") || undefined;
  const chineseText = get("chineseText") || undefined;

  if (!englishText && !japaneseText && !chineseText) return null;

  const primaryText = englishText || japaneseText || chineseText || "";
  const id = get("id") || stableId(primaryText);

  const tagsRaw = get("tags");
  const tags = tagsRaw
    ? tagsRaw.includes("|")
      ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
      : tagsRaw.split(/\s+/).filter(Boolean)
    : [];

  const foreignLangRaw = get("foreignLanguage");
  const foreignLanguage: ForeignLanguage =
    (["en", "ja", "zh"].includes(foreignLangRaw) ? foreignLangRaw as ForeignLanguage : null) ??
    (japaneseText ? "ja" : chineseText ? "zh" : "en");

  const koreanText = get("koreanText") || undefined;
  const modelKorean = get("modelKorean") || undefined;
  const modelEnglish = get("modelEnglish") || undefined;
  const modelJapanese = get("modelJapanese") || undefined;
  const modelChinese = get("modelChinese") || undefined;
  const enAudioType = get("englishAudioType") || "tts";
  const koAudioType = get("koreanAudioType") || "tts";
  const jaAudioType = get("japaneseAudioType") || "tts";
  const zhAudioType = get("chineseAudioType") || "tts";

  const diffRaw = parseInt(get("difficulty"), 10);
  const difficulty = ([1, 2, 3].includes(diffRaw) ? diffRaw : 1) as 1 | 2 | 3;

  return {
    id,
    category: (get("category") as Category) || "daily",
    difficulty,
    foreignLanguage,
    englishText,
    koreanText,
    englishAudio: enAudioType === "file"
      ? { type: "file", uri: get("englishAudioUri") }
      : { type: "tts" },
    koreanAudio: koAudioType === "file"
      ? { type: "file", uri: get("koreanAudioUri") }
      : { type: "tts" },
    japaneseText,
    japaneseAudio: jaAudioType === "file"
      ? { type: "file", uri: get("japaneseAudioUri") }
      : { type: "tts" },
    chineseText,
    chineseAudio: zhAudioType === "file"
      ? { type: "file", uri: get("chineseAudioUri") }
      : { type: "tts" },
    modelKorean,
    modelEnglish,
    modelJapanese,
    modelChinese,
    tags,
    notes: get("notes") || undefined,
  };
}

async function importCSVContent(content: string): Promise<{ imported: number; failed: number }> {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, failed: 0 };

  const headers = parseCSVLine(lines[0]);
  if (!headers.includes("englishText") && !headers.includes("japaneseText") && !headers.includes("chineseText")) {
    throw new Error(
      `필수 컬럼이 없습니다.\n\n첫 번째 행(헤더)을 확인하세요.\n필수(하나 이상): englishText / japaneseText / chineseText\n권장: koreanText, category, difficulty`
    );
  }
  const keepDifficulty = !headers.includes("difficulty");
  const hasProgress =
    headers.includes("enkoNextReviewDate") || headers.includes("koenNextReviewDate") ||
    headers.includes("jakoNextReviewDate") || headers.includes("kojaNextReviewDate") ||
    headers.includes("zhkoNextReviewDate") || headers.includes("kozhNextReviewDate");

  const rows: { entry: SentenceEntry; cols: string[] }[] = [];
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const entry = rowToEntry(cols, headers);
    if (entry) rows.push({ entry, cols });
    else failed++;
  }

  const db = await getDB();
  await db.withTransactionAsync(async () => {
    for (const { entry: e, cols } of rows) {
      const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";
      const diffParam = keepDifficulty ? null : e.difficulty;

      await db.runAsync(
        `INSERT INTO sentences (
          id, category, difficulty, foreign_language,
          english_text, korean_text,
          english_audio_type, english_audio_uri,
          korean_audio_type, korean_audio_uri,
          japanese_text, japanese_audio_type, japanese_audio_uri,
          chinese_text, chinese_audio_type, chinese_audio_uri,
          model_korean, model_english, model_japanese, model_chinese,
          tags, duration_seconds, notes
        ) VALUES (?, ?, COALESCE(?, 2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          difficulty = COALESCE(excluded.difficulty, sentences.difficulty),
          foreign_language = excluded.foreign_language,
          english_text = excluded.english_text,
          korean_text = excluded.korean_text,
          english_audio_type = excluded.english_audio_type,
          english_audio_uri = excluded.english_audio_uri,
          korean_audio_type = excluded.korean_audio_type,
          korean_audio_uri = excluded.korean_audio_uri,
          japanese_text = excluded.japanese_text,
          japanese_audio_type = excluded.japanese_audio_type,
          japanese_audio_uri = excluded.japanese_audio_uri,
          chinese_text = excluded.chinese_text,
          chinese_audio_type = excluded.chinese_audio_type,
          chinese_audio_uri = excluded.chinese_audio_uri,
          model_korean = excluded.model_korean,
          model_english = excluded.model_english,
          model_japanese = excluded.model_japanese,
          model_chinese = excluded.model_chinese,
          tags = excluded.tags,
          duration_seconds = excluded.duration_seconds,
          notes = excluded.notes`,
        [
          e.id, e.category, diffParam, e.foreignLanguage ?? "en",
          e.englishText, e.koreanText ?? null,
          e.englishAudio?.type ?? "tts",
          e.englishAudio?.type === "file" ? e.englishAudio.uri : null,
          e.koreanAudio?.type ?? "tts",
          e.koreanAudio?.type === "file" ? e.koreanAudio.uri : null,
          e.japaneseText ?? null,
          e.japaneseAudio?.type ?? "tts",
          e.japaneseAudio?.type === "file" ? e.japaneseAudio.uri : null,
          e.chineseText ?? null,
          e.chineseAudio?.type ?? "tts",
          e.chineseAudio?.type === "file" ? e.chineseAudio.uri : null,
          e.modelKorean ?? null, e.modelEnglish ?? null,
          e.modelJapanese ?? null, e.modelChinese ?? null,
          JSON.stringify(e.tags), e.durationSeconds ?? null, e.notes ?? null,
        ]
      );

      if (hasProgress) {
        await upsertProgressFromRow(db, e.id, "en-ko", {
          nextReviewDate: get("enkoNextReviewDate"),
          intervalDays: get("enkoIntervalDays"),
          reviewCount: get("enkoReviewCount"),
          lastStudiedAt: get("enkoLastStudiedAt"),
        });
        await upsertProgressFromRow(db, e.id, "ko-en", {
          nextReviewDate: get("koenNextReviewDate"),
          intervalDays: get("koenIntervalDays"),
          reviewCount: get("koenReviewCount"),
          lastStudiedAt: get("koenLastStudiedAt"),
        });
        await upsertProgressFromRow(db, e.id, "ja-ko", {
          nextReviewDate: get("jakoNextReviewDate"),
          intervalDays: get("jakoIntervalDays"),
          reviewCount: get("jakoReviewCount"),
          lastStudiedAt: get("jakoLastStudiedAt"),
        });
        await upsertProgressFromRow(db, e.id, "ko-ja", {
          nextReviewDate: get("kojaNextReviewDate"),
          intervalDays: get("kojaIntervalDays"),
          reviewCount: get("kojaReviewCount"),
          lastStudiedAt: get("kojaLastStudiedAt"),
        });
        await upsertProgressFromRow(db, e.id, "zh-ko", {
          nextReviewDate: get("zhkoNextReviewDate"),
          intervalDays: get("zhkoIntervalDays"),
          reviewCount: get("zhkoReviewCount"),
          lastStudiedAt: get("zhkoLastStudiedAt"),
        });
        await upsertProgressFromRow(db, e.id, "ko-zh", {
          nextReviewDate: get("kozhNextReviewDate"),
          intervalDays: get("kozhIntervalDays"),
          reviewCount: get("kozhReviewCount"),
          lastStudiedAt: get("kozhLastStudiedAt"),
        });
      }
    }
  });

  return { imported: rows.length, failed };
}

async function upsertProgressFromRow(
  db: any,
  sentenceId: string,
  direction: string,
  fields: { nextReviewDate: string; intervalDays: string; reviewCount: string; lastStudiedAt: string }
) {
  const nextReviewDate = parseInt(fields.nextReviewDate, 10);
  const intervalDays = parseInt(fields.intervalDays, 10);
  if (!nextReviewDate || !intervalDays) return;
  const reviewCount = parseInt(fields.reviewCount, 10) || 0;
  const lastStudiedAt = parseInt(fields.lastStudiedAt, 10) || null;

  await db.runAsync(
    `INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at, first_studied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sentence_id, direction) DO UPDATE SET
       next_review_date = excluded.next_review_date,
       interval_days = excluded.interval_days,
       review_count = excluded.review_count,
       last_studied_at = excluded.last_studied_at`,
    [sentenceId, direction, nextReviewDate, intervalDays, reviewCount, lastStudiedAt, lastStudiedAt]
  );
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
