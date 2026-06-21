import { getDB } from "./schema";
import type { SentenceEntry, SentenceProgress, Direction, Category, ForeignLanguage } from "../types";

function rowToProgress(row: any): SentenceProgress {
  return {
    sentenceId: row.sentence_id,
    direction: row.direction as Direction,
    nextReviewDate: row.next_review_date,
    intervalDays: row.interval_days,
    reviewCount: row.review_count,
    lastStudiedAt: row.last_studied_at,
  };
}

function rowToSentence(row: any): SentenceEntry {
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    foreignLanguage: (row.foreign_language ?? "en") as ForeignLanguage,
    englishText: row.english_text,
    koreanText: row.korean_text ?? undefined,
    englishAudio: row.english_audio_type === "file"
      ? { type: "file" as const, uri: row.english_audio_uri }
      : { type: "tts" as const },
    koreanAudio: row.korean_audio_type === "file"
      ? { type: "file" as const, uri: row.korean_audio_uri }
      : { type: "tts" as const },
    japaneseText: row.japanese_text ?? undefined,
    japaneseAudio: row.japanese_audio_type === "file"
      ? { type: "file" as const, uri: row.japanese_audio_uri }
      : { type: "tts" as const },
    chineseText: row.chinese_text ?? undefined,
    chineseAudio: row.chinese_audio_type === "file"
      ? { type: "file" as const, uri: row.chinese_audio_uri }
      : { type: "tts" as const },
    modelKorean: row.model_korean ?? undefined,
    modelEnglish: row.model_english ?? undefined,
    modelJapanese: row.model_japanese ?? undefined,
    modelChinese: row.model_chinese ?? undefined,
    tags: JSON.parse(row.tags ?? "[]"),
    durationSeconds: row.duration_seconds ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function getDueForReview(now: number = Date.now()): Promise<SentenceProgress[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM sentence_progress WHERE next_review_date <= ? ORDER BY next_review_date ASC",
    [now]
  );
  return rows.map(rowToProgress);
}

export async function getDueWithSentences(
  now: number = Date.now(),
  foreignLanguage?: ForeignLanguage
): Promise<Array<{ sentence: SentenceEntry; direction: Direction; intervalDays: number }>> {
  const db = await getDB();
  const params: any[] = [now];
  let langFilter = "";
  if (foreignLanguage) {
    langFilter = " AND s.foreign_language = ?";
    params.push(foreignLanguage);
  }
  const rows = await db.getAllAsync<any>(
    `SELECT s.*, sp.direction as sp_direction, sp.interval_days as sp_interval_days
     FROM sentence_progress sp
     JOIN sentences s ON s.id = sp.sentence_id
     WHERE sp.next_review_date <= ? AND s.is_draft = 0${langFilter}
     ORDER BY sp.next_review_date ASC`,
    params
  );
  return rows.map((row) => ({
    direction: row.sp_direction as Direction,
    intervalDays: row.sp_interval_days as number,
    sentence: rowToSentence(row),
  }));
}

export async function getNewSentences(
  direction: Direction,
  category: Category | null,
  limit: number = 10
): Promise<SentenceEntry[]> {
  const db = await getDB();
  const params: any[] = [direction];
  let filter = "";

  // foreign_language filter derived from direction
  const foreignLang = direction.replace("ko-", "").replace("-ko", "") === "ko"
    ? "en"
    : direction.startsWith("ko-")
      ? direction.replace("ko-", "")
      : direction.replace("-ko", "");
  filter += " AND s.foreign_language = ?";
  params.push(foreignLang === "ko" ? "en" : foreignLang);

  if (category) {
    filter += " AND s.category = ?";
    params.push(category);
  }
  if (direction === "ko-en" || direction === "ko-ja" || direction === "ko-zh") {
    filter += " AND s.korean_text IS NOT NULL";
  }
  if (direction === "ja-ko") filter += " AND s.japanese_text IS NOT NULL";
  if (direction === "zh-ko") filter += " AND s.chinese_text IS NOT NULL";

  params.push(limit);

  const rows = await db.getAllAsync<any>(
    `SELECT s.* FROM sentences s
     LEFT JOIN sentence_progress sp ON s.id = sp.sentence_id AND sp.direction = ?
     WHERE sp.sentence_id IS NULL AND s.is_draft = 0${filter}
     ORDER BY s.difficulty ASC, s.id ASC
     LIMIT ?`,
    params
  );
  return rows.map(rowToSentence);
}

export async function getProgress(
  sentenceId: string,
  direction: Direction
): Promise<SentenceProgress | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    "SELECT * FROM sentence_progress WHERE sentence_id = ? AND direction = ?",
    [sentenceId, direction]
  );
  return row ? rowToProgress(row) : null;
}

export async function countNewStudiedToday(): Promise<number> {
  const db = await getDB();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(DISTINCT sentence_id) as cnt FROM sentence_progress
     WHERE first_studied_at >= ?`,
    [todayStart.getTime()]
  );
  return row?.cnt ?? 0;
}

export async function getProgressSummaryByIds(
  sentenceIds: string[]
): Promise<Record<string, { lastStudiedAt: number | null; nextReviewDate: number | null }>> {
  if (sentenceIds.length === 0) return {};
  const db = await getDB();
  const placeholders = sentenceIds.map(() => "?").join(",");
  const rows = await db.getAllAsync<any>(
    `SELECT sentence_id,
       MAX(last_studied_at) AS last_studied_at,
       MIN(next_review_date) AS next_review_date
     FROM sentence_progress
     WHERE sentence_id IN (${placeholders})
     GROUP BY sentence_id`,
    sentenceIds
  );
  const map: Record<string, { lastStudiedAt: number | null; nextReviewDate: number | null }> = {};
  for (const row of rows) {
    map[row.sentence_id] = {
      lastStudiedAt: row.last_studied_at ?? null,
      nextReviewDate: row.next_review_date ?? null,
    };
  }
  return map;
}

export async function getTodaySentences(
  foreignLanguage?: ForeignLanguage
): Promise<Array<{ sentence: SentenceEntry; direction: Direction }>> {
  const db = await getDB();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const params: any[] = [todayStart.getTime()];
  let langFilter = "";
  if (foreignLanguage) {
    langFilter = " AND s.foreign_language = ?";
    params.push(foreignLanguage);
  }
  const rows = await db.getAllAsync<any>(
    `SELECT DISTINCT s.*, sr.direction as sr_direction
     FROM session_results sr
     JOIN sentences s ON s.id = sr.sentence_id
     WHERE sr.timestamp >= ?${langFilter}
     ORDER BY sr.timestamp DESC`,
    params
  );
  const seen = new Set<string>();
  const result: Array<{ sentence: SentenceEntry; direction: Direction }> = [];
  for (const row of rows) {
    const key = `${row.id}:${row.sr_direction}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ sentence: rowToSentence(row), direction: row.sr_direction as Direction });
    }
  }
  return result;
}


  sentenceId: string,
  direction: Direction,
  intervalDays: number
): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const nextReviewDate = now + intervalDays * 24 * 60 * 60 * 1000;

  await db.runAsync(
    `INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at, first_studied_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(sentence_id, direction) DO UPDATE SET
       next_review_date = excluded.next_review_date,
       interval_days = excluded.interval_days,
       review_count = review_count + 1,
       last_studied_at = excluded.last_studied_at`,
    [sentenceId, direction, nextReviewDate, intervalDays, now, now]
  );
}
