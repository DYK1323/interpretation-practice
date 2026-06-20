import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

async function _runInit(): Promise<void> {
  const database = await SQLite.openDatabaseAsync("interp.db");
  db = database;

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

  const sentenceCols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sentences)`);
  if (!sentenceCols.some(c => c.name === "notes")) {
    await database.execAsync(`ALTER TABLE sentences ADD COLUMN notes TEXT`);
  }
  if (!sentenceCols.some(c => c.name === "is_draft")) {
    await database.execAsync(`ALTER TABLE sentences ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0`);
  }

  const progressCols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(sentence_progress)`);
  if (!progressCols.some(c => c.name === "first_studied_at")) {
    await database.execAsync(`ALTER TABLE sentence_progress ADD COLUMN first_studied_at INTEGER`);
  }

  const resultCols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(session_results)`);
  if (!resultCols.some(c => c.name === "back_interp_recording_uri")) {
    await database.execAsync(`ALTER TABLE session_results ADD COLUMN back_interp_recording_uri TEXT`);
  }
}

export function initDB(): Promise<void> {
  if (!initPromise) {
    initPromise = _runInit();
  }
  return initPromise;
}

// All DB access goes through here — waits for full init before returning
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  await initDB();
  return db!;
}
