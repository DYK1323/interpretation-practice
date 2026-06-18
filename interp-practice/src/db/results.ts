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
