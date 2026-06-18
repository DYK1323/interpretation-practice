import { getDB } from "./schema";
import type { SentenceProgress, Direction } from "../types";

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

export async function getDueForReview(now: number = Date.now()): Promise<SentenceProgress[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM sentence_progress WHERE next_review_date <= ? ORDER BY next_review_date ASC",
    [now]
  );
  return rows.map(rowToProgress);
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

export async function scheduleReview(
  sentenceId: string,
  direction: Direction,
  intervalDays: number
): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const nextReviewDate = now + intervalDays * 24 * 60 * 60 * 1000;

  await db.runAsync(
    `INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(sentence_id, direction) DO UPDATE SET
       next_review_date = excluded.next_review_date,
       interval_days = excluded.interval_days,
       review_count = review_count + 1,
       last_studied_at = excluded.last_studied_at`,
    [sentenceId, direction, nextReviewDate, intervalDays, now]
  );
}
