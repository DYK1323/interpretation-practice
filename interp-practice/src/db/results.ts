import { getDB } from "./schema";
import type { SessionResult, Direction } from "../types";

function rowToResult(row: any): SessionResult {
  return {
    id: row.id,
    sentenceId: row.sentence_id,
    direction: row.direction as Direction,
    timestamp: row.timestamp,
    interpRecordingUri: row.interp_recording_uri ?? undefined,
    backInterpText: row.back_interp_text ?? "",
    originalText: row.original_text,
    notes: row.notes ?? undefined,
  };
}

export async function saveResult(result: SessionResult): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO session_results
     (id, sentence_id, direction, timestamp, interp_recording_uri, back_interp_text, original_text, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      result.sentenceId,
      result.direction,
      result.timestamp,
      result.interpRecordingUri ?? null,
      result.backInterpText,
      result.originalText,
      result.notes ?? null,
    ]
  );
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE session_results SET notes = ? WHERE id = ?", [notes, id]);
}

export async function getResultsForSentence(
  sentenceId: string,
  direction: Direction
): Promise<SessionResult[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM session_results WHERE sentence_id = ? AND direction = ? ORDER BY timestamp DESC",
    [sentenceId, direction]
  );
  return rows.map(rowToResult);
}

export async function getAllResults(limit = 50): Promise<SessionResult[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM session_results ORDER BY timestamp DESC LIMIT ?",
    [limit]
  );
  return rows.map(rowToResult);
}

// Returns { "2026-06-18": 3, "2026-06-17": 1, ... } for the past `days` days
export async function getHeatmapData(days: number): Promise<Record<string, number>> {
  const db = await getDB();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await db.getAllAsync<{ day: string; count: number }>(
    `SELECT date(timestamp / 1000, 'unixepoch', 'localtime') AS day,
            COUNT(DISTINCT sentence_id) AS count
     FROM session_results
     WHERE timestamp >= ?
     GROUP BY day`,
    [since]
  );
  const result: Record<string, number> = {};
  for (const row of rows) result[row.day] = row.count;
  return result;
}

export async function getStats(): Promise<{
  streak: number;
  totalSentences: number;
  todayCount: number;
}> {
  const db = await getDB();

  const totalRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(DISTINCT sentence_id) AS count FROM session_results"
  );

  const todayRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM session_results
     WHERE date(timestamp / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')`
  );

  // Load distinct active days for the past year, sorted descending
  const dayRows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(timestamp / 1000, 'unixepoch', 'localtime') AS day
     FROM session_results
     ORDER BY day DESC
     LIMIT 366`
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of dayRows) {
    const d = new Date(row.day);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diffDays === streak) {
      streak++;
    } else {
      break;
    }
  }

  return {
    streak,
    totalSentences: totalRow?.count ?? 0,
    todayCount: todayRow?.count ?? 0,
  };
}
