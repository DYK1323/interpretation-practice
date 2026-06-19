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
  const rows = await db.getAllAsync<any>("SELECT * FROM sentences ORDER BY category, difficulty, id");
  return rows.map(rowToEntry);
}

export async function getSentencesByCategory(
  category: Category,
  difficulty?: 1 | 2 | 3,
  direction?: Direction
): Promise<SentenceEntry[]> {
  const db = await getDB();
  let query = "SELECT * FROM sentences WHERE category = ?";
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

export async function upsertSentence(entry: SentenceEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO sentences (
      id, category, difficulty, english_text, korean_text,
      english_audio_type, english_audio_uri,
      korean_audio_type, korean_audio_uri,
      model_korean, model_english, tags, duration_seconds, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      difficulty = excluded.difficulty,
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
      entry.id,
      entry.category,
      entry.difficulty,
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
    ]
  );
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
