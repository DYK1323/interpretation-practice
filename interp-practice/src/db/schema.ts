import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("interp.db");
  }
  return db;
}

export async function initDB(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`PRAGMA journal_mode = WAL;`);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sentences (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 1,
      english_text TEXT NOT NULL,
      korean_text TEXT,
      english_audio_type TEXT DEFAULT 'tts',
      english_audio_uri TEXT,
      korean_audio_type TEXT DEFAULT 'tts',
      korean_audio_uri TEXT,
      model_korean TEXT,
      model_english TEXT,
      tags TEXT DEFAULT '[]',
      duration_seconds REAL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sentence_progress (
      sentence_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      next_review_date INTEGER,
      interval_days INTEGER DEFAULT 1,
      review_count INTEGER DEFAULT 0,
      last_studied_at INTEGER,
      PRIMARY KEY (sentence_id, direction)
    );

    CREATE TABLE IF NOT EXISTS session_results (
      id TEXT PRIMARY KEY,
      sentence_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      interp_recording_uri TEXT,
      back_interp_text TEXT DEFAULT '',
      original_text TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add notes column if it doesn't exist yet
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sentences)`);
  if (!cols.some(c => c.name === "notes")) {
    await database.execAsync(`ALTER TABLE sentences ADD COLUMN notes TEXT`);
  }
}
