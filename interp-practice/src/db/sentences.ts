import { getDB } from "./schema";
import type { SentenceEntry, Category, Direction } from "../types";

function rowToEntry(row: any): SentenceEntry {
  const englishAudioType = row.english_audio_type ?? "tts";
  const koreanAudioType = row.korean_audio_type ?? "tts";
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    englishText: row.english_text,
    koreanText: row.korean_text ?? undefined,
    englishAudio:
      englishAudioType === "file"
        ? { type: "file", uri: row.english_audio_uri }
        : { type: "tts" },
    koreanAudio:
      koreanAudioType === "file"
        ? { type: "file", uri: row.korean_audio_uri }
        : { type: "tts" },
    modelKorean: row.model_korean ?? undefined,
    modelEnglish: row.model_english ?? undefined,
    tags: JSON.parse(row.tags ?? "[]"),
    durationSeconds: row.duration_seconds ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function getAllSentences(): Promise<SentenceEntry[]> {
  const db = await getDB();
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
  if (direction === "ko-en") {
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
      id, category, difficulty, english_text, korean_text,
      english_audio_type, english_audio_uri,
      korean_audio_type, korean_audio_uri,
      model_korean, model_english, tags, duration_seconds, notes, is_draft
    ) VALUES (?, ?, COALESCE(?, 2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notes = excluded.notes,
      is_draft = excluded.is_draft`,
    [
      entry.id,
      entry.category,
      diffParam,
      entry.englishText,
      entry.koreanText ?? null,
      entry.englishAudio?.type ?? "tts",
      entry.englishAudio?.type === "file" ? entry.englishAudio.uri : null,
      entry.koreanAudio?.type ?? "tts",
      entry.koreanAudio?.type === "file" ? entry.koreanAudio.uri : null,
      entry.modelKorean ?? null,
      entry.modelEnglish ?? null,
      JSON.stringify(entry.tags),
      entry.durationSeconds ?? null,
      entry.notes ?? null,
      isDraft,
    ]
  );
}

export async function cleanupDrafts(): Promise<void> {
  const db = await getDB();
  const drafts = await db.getAllAsync<{ id: string; english_audio_uri: string | null; korean_audio_uri: string | null }>(
    "SELECT id, english_audio_uri, korean_audio_uri FROM sentences WHERE is_draft = 1"
  );
  if (drafts.length === 0) return;

  const { deleteAsync } = await import("expo-file-system");
  for (const row of drafts) {
    if (row.english_audio_uri) {
      try { await deleteAsync(row.english_audio_uri, { idempotent: true }); } catch {}
    }
    if (row.korean_audio_uri) {
      try { await deleteAsync(row.korean_audio_uri, { idempotent: true }); } catch {}
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
  lang: "english" | "korean",
  audioUri: string
): Promise<void> {
  const db = await getDB();
  const col = lang === "english" ? "english" : "korean";
  await db.runAsync(
    `UPDATE sentences SET ${col}_audio_type = 'file', ${col}_audio_uri = ? WHERE id = ?`,
    [audioUri, id]
  );
}

export async function updateModelInterpretation(
  id: string,
  modelKorean?: string,
  modelEnglish?: string
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "UPDATE sentences SET model_korean = ?, model_english = ? WHERE id = ?",
    [modelKorean ?? null, modelEnglish ?? null, id]
  );
}

export async function deleteSentence(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM sentences WHERE id = ?", [id]);
}
