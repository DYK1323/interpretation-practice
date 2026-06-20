import { getDB } from "./schema";
import type { SentenceEntry, Category, Direction, ForeignLanguage } from "../types";

function rowToEntry(row: any): SentenceEntry {
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    foreignLanguage: (row.foreign_language ?? "en") as ForeignLanguage,
    englishText: row.english_text,
    koreanText: row.korean_text ?? undefined,
    englishAudio: row.english_audio_type === "file"
      ? { type: "file", uri: row.english_audio_uri }
      : { type: "tts" },
    koreanAudio: row.korean_audio_type === "file"
      ? { type: "file", uri: row.korean_audio_uri }
      : { type: "tts" },
    japaneseText: row.japanese_text ?? undefined,
    japaneseAudio: row.japanese_audio_type === "file"
      ? { type: "file", uri: row.japanese_audio_uri }
      : { type: "tts" },
    chineseText: row.chinese_text ?? undefined,
    chineseAudio: row.chinese_audio_type === "file"
      ? { type: "file", uri: row.chinese_audio_uri }
      : { type: "tts" },
    modelKorean: row.model_korean ?? undefined,
    modelEnglish: row.model_english ?? undefined,
    modelJapanese: row.model_japanese ?? undefined,
    modelChinese: row.model_chinese ?? undefined,
    tags: JSON.parse(row.tags ?? "[]"),
    durationSeconds: row.duration_seconds ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function getAllSentences(foreignLanguage?: ForeignLanguage): Promise<SentenceEntry[]> {
  const db = await getDB();
  if (foreignLanguage) {
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM sentences WHERE is_draft = 0 AND foreign_language = ? ORDER BY category, difficulty, id",
      [foreignLanguage]
    );
    return rows.map(rowToEntry);
  }
  const rows = await db.getAllAsync<any>("SELECT * FROM sentences WHERE is_draft = 0 ORDER BY category, difficulty, id");
  return rows.map(rowToEntry);
}

export async function getSentencesByCategory(
  category: Category,
  difficulty?: 1 | 2 | 3,
  direction?: Direction
): Promise<SentenceEntry[]> {
  const db = await getDB();
  let query = "SELECT * FROM sentences WHERE category = ? AND is_draft = 0";
  const params: any[] = [category];

  if (difficulty) {
    query += " AND difficulty = ?";
    params.push(difficulty);
  }
  if (direction === "ko-en" || direction === "ko-ja" || direction === "ko-zh") {
    query += " AND korean_text IS NOT NULL";
  }

  query += " ORDER BY difficulty, id";
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(rowToEntry);
}

export async function getSentenceById(id: string): Promise<SentenceEntry | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>("SELECT * FROM sentences WHERE id = ?", [id]);
  return row ? rowToEntry(row) : null;
}

export async function getSentencesByIds(ids: string[]): Promise<Record<string, SentenceEntry>> {
  if (ids.length === 0) return {};
  const db = await getDB();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sentences WHERE id IN (${placeholders}) AND is_draft = 0`,
    ids
  );
  return Object.fromEntries(rows.map(r => [r.id, rowToEntry(r)]));
}

export async function upsertSentence(
  entry: SentenceEntry,
  opts?: { keepDifficulty?: boolean; isDraft?: boolean }
): Promise<void> {
  const db = await getDB();
  const diffParam = opts?.keepDifficulty ? null : entry.difficulty;
  const isDraft = opts?.isDraft ? 1 : 0;
  await db.runAsync(
    `INSERT INTO sentences (
      id, category, difficulty, foreign_language,
      english_text, korean_text,
      english_audio_type, english_audio_uri,
      korean_audio_type, korean_audio_uri,
      japanese_text, japanese_audio_type, japanese_audio_uri,
      chinese_text, chinese_audio_type, chinese_audio_uri,
      model_korean, model_english, model_japanese, model_chinese,
      tags, duration_seconds, notes, is_draft
    ) VALUES (?, ?, COALESCE(?, 2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notes = excluded.notes,
      is_draft = excluded.is_draft`,
    [
      entry.id,
      entry.category,
      diffParam,
      entry.foreignLanguage ?? "en",
      entry.englishText,
      entry.koreanText ?? null,
      entry.englishAudio?.type ?? "tts",
      entry.englishAudio?.type === "file" ? entry.englishAudio.uri : null,
      entry.koreanAudio?.type ?? "tts",
      entry.koreanAudio?.type === "file" ? entry.koreanAudio.uri : null,
      entry.japaneseText ?? null,
      entry.japaneseAudio?.type ?? "tts",
      entry.japaneseAudio?.type === "file" ? entry.japaneseAudio.uri : null,
      entry.chineseText ?? null,
      entry.chineseAudio?.type ?? "tts",
      entry.chineseAudio?.type === "file" ? entry.chineseAudio.uri : null,
      entry.modelKorean ?? null,
      entry.modelEnglish ?? null,
      entry.modelJapanese ?? null,
      entry.modelChinese ?? null,
      JSON.stringify(entry.tags),
      entry.durationSeconds ?? null,
      entry.notes ?? null,
      isDraft,
    ]
  );
}

export async function cleanupDrafts(): Promise<void> {
  const db = await getDB();
  const drafts = await db.getAllAsync<{
    id: string;
    english_audio_uri: string | null;
    korean_audio_uri: string | null;
    japanese_audio_uri: string | null;
    chinese_audio_uri: string | null;
  }>(
    "SELECT id, english_audio_uri, korean_audio_uri, japanese_audio_uri, chinese_audio_uri FROM sentences WHERE is_draft = 1"
  );
  if (drafts.length === 0) return;

  const { deleteAsync } = await import("expo-file-system");
  for (const row of drafts) {
    for (const uri of [row.english_audio_uri, row.korean_audio_uri, row.japanese_audio_uri, row.chinese_audio_uri]) {
      if (uri) {
        try { await deleteAsync(uri, { idempotent: true }); } catch {}
      }
    }
  }
  await db.runAsync("DELETE FROM sentences WHERE is_draft = 1");
}

export async function updateSentenceDifficulty(id: string, difficulty: 1 | 2 | 3): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE sentences SET difficulty = ? WHERE id = ?", [difficulty, id]);
}

export async function updateSentenceAudio(
  id: string,
  lang: "english" | "korean" | "japanese" | "chinese",
  audioUri: string
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE sentences SET ${lang}_audio_type = 'file', ${lang}_audio_uri = ? WHERE id = ?`,
    [audioUri, id]
  );
}

export async function updateModelInterpretation(
  id: string,
  modelKorean?: string,
  modelEnglish?: string,
  modelJapanese?: string,
  modelChinese?: string
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "UPDATE sentences SET model_korean = ?, model_english = ?, model_japanese = ?, model_chinese = ? WHERE id = ?",
    [modelKorean ?? null, modelEnglish ?? null, modelJapanese ?? null, modelChinese ?? null, id]
  );
}

export async function deleteSentence(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM sentences WHERE id = ?", [id]);
}
