use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioSource {
    r#type: String,
    uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SentenceEntry {
    id: String,
    category: String,
    difficulty: i64,
    foreign_language: String,
    english_text: String,
    korean_text: Option<String>,
    english_audio: Option<AudioSource>,
    korean_audio: Option<AudioSource>,
    japanese_text: Option<String>,
    japanese_audio: Option<AudioSource>,
    chinese_text: Option<String>,
    chinese_audio: Option<AudioSource>,
    model_korean: Option<String>,
    model_english: Option<String>,
    model_japanese: Option<String>,
    model_chinese: Option<String>,
    tags: Vec<String>,
    duration_seconds: Option<f64>,
    notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionResult {
    id: String,
    sentence_id: String,
    direction: String,
    timestamp: i64,
    interp_recording_uri: Option<String>,
    back_interp_recording_uri: Option<String>,
    back_interp_text: String,
    original_text: String,
    notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserSettings {
    show_source_text_during_listen: bool,
    playback_speed: f64,
    shuffle_sentences: bool,
    daily_new_limit: i64,
    foreign_language: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueueItem {
    sentence: SentenceEntry,
    direction: String,
}

fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("recordings")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("sentence-audio")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("tts-cache")).map_err(|e| e.to_string())?;
    Ok(dir.join("interp.db"))
}

fn conn(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(db_path(app)?).map_err(|e| e.to_string())?;
    init_schema(&connection)?;
    Ok(connection)
}

fn init_schema(db: &Connection) -> Result<(), String> {
    db.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
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
          notes TEXT,
          is_draft INTEGER NOT NULL DEFAULT 0,
          foreign_language TEXT NOT NULL DEFAULT 'en',
          japanese_text TEXT,
          japanese_audio_type TEXT DEFAULT 'tts',
          japanese_audio_uri TEXT,
          chinese_text TEXT,
          chinese_audio_type TEXT DEFAULT 'tts',
          chinese_audio_uri TEXT,
          model_japanese TEXT,
          model_chinese TEXT
        );
        CREATE TABLE IF NOT EXISTS sentence_progress (
          sentence_id TEXT NOT NULL,
          direction TEXT NOT NULL,
          next_review_date INTEGER,
          interval_days INTEGER DEFAULT 1,
          review_count INTEGER DEFAULT 0,
          last_studied_at INTEGER,
          first_studied_at INTEGER,
          PRIMARY KEY (sentence_id, direction)
        );
        CREATE TABLE IF NOT EXISTS session_results (
          id TEXT PRIMARY KEY,
          sentence_id TEXT NOT NULL,
          direction TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          interp_recording_uri TEXT,
          back_interp_recording_uri TEXT,
          back_interp_text TEXT DEFAULT '',
          original_text TEXT NOT NULL,
          notes TEXT
        );
        CREATE TABLE IF NOT EXISTS user_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())
}

fn audio_type(audio: &Option<AudioSource>) -> String {
    audio.as_ref().map(|a| a.r#type.clone()).unwrap_or_else(|| "tts".to_string())
}

fn audio_uri(audio: &Option<AudioSource>) -> Option<String> {
    audio.as_ref().and_then(|a| if a.r#type == "file" { a.uri.clone() } else { None })
}

fn row_to_sentence(row: &rusqlite::Row<'_>) -> rusqlite::Result<SentenceEntry> {
    let tags_json: String = row.get("tags")?;
    let tags = serde_json::from_str(&tags_json).unwrap_or_default();
    let audio = |prefix: &str, row: &rusqlite::Row<'_>| -> rusqlite::Result<Option<AudioSource>> {
        let typ: Option<String> = row.get(format!("{prefix}_audio_type").as_str())?;
        let uri: Option<String> = row.get(format!("{prefix}_audio_uri").as_str())?;
        Ok(Some(AudioSource { r#type: typ.unwrap_or_else(|| "tts".to_string()), uri }))
    };
    Ok(SentenceEntry {
        id: row.get("id")?,
        category: row.get("category")?,
        difficulty: row.get("difficulty")?,
        foreign_language: row.get("foreign_language")?,
        english_text: row.get("english_text")?,
        korean_text: row.get("korean_text")?,
        english_audio: audio("english", row)?,
        korean_audio: audio("korean", row)?,
        japanese_text: row.get("japanese_text")?,
        japanese_audio: audio("japanese", row)?,
        chinese_text: row.get("chinese_text")?,
        chinese_audio: audio("chinese", row)?,
        model_korean: row.get("model_korean")?,
        model_english: row.get("model_english")?,
        model_japanese: row.get("model_japanese")?,
        model_chinese: row.get("model_chinese")?,
        tags,
        duration_seconds: row.get("duration_seconds")?,
        notes: row.get("notes")?,
    })
}

#[tauri::command]
fn init_db(app: tauri::AppHandle) -> Result<String, String> {
    let path = db_path(&app)?;
    let db = Connection::open(&path).map_err(|e| e.to_string())?;
    init_schema(&db)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_all_settings(app: tauri::AppHandle) -> Result<UserSettings, String> {
    let db = conn(&app)?;
    let mut settings = UserSettings {
        show_source_text_during_listen: false,
        playback_speed: 1.0,
        shuffle_sentences: true,
        daily_new_limit: 10,
        foreign_language: "en".to_string(),
    };
    let mut stmt = db.prepare("SELECT key, value FROM user_settings").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    for pair in rows {
        let (key, value) = pair.map_err(|e| e.to_string())?;
        match key.as_str() {
            "showSourceTextDuringListen" => settings.show_source_text_during_listen = serde_json::from_str(&value).unwrap_or(false),
            "playbackSpeed" => settings.playback_speed = serde_json::from_str(&value).unwrap_or(1.0),
            "shuffleSentences" => settings.shuffle_sentences = serde_json::from_str(&value).unwrap_or(true),
            "dailyNewLimit" => settings.daily_new_limit = serde_json::from_str(&value).unwrap_or(10),
            "foreignLanguage" => settings.foreign_language = serde_json::from_str(&value).unwrap_or_else(|_| "en".to_string()),
            _ => {}
        }
    }
    Ok(settings)
}

#[tauri::command]
fn set_setting(app: tauri::AppHandle, key: String, value: serde_json::Value) -> Result<(), String> {
    let db = conn(&app)?;
    db.execute("INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)", params![key, value.to_string()])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_string_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let db = conn(&app)?;
    db.query_row("SELECT value FROM user_settings WHERE key = ?", params![key], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_string_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let db = conn(&app)?;
    db.execute("INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)", params![key, value])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn upsert_sentence(app: tauri::AppHandle, entry: SentenceEntry) -> Result<(), String> {
    let db = conn(&app)?;
    db.execute(
        r#"
        INSERT INTO sentences (
          id, category, difficulty, foreign_language,
          english_text, korean_text,
          english_audio_type, english_audio_uri,
          korean_audio_type, korean_audio_uri,
          japanese_text, japanese_audio_type, japanese_audio_uri,
          chinese_text, chinese_audio_type, chinese_audio_uri,
          model_korean, model_english, model_japanese, model_chinese,
          tags, duration_seconds, notes, is_draft
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          difficulty = excluded.difficulty,
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
          is_draft = 0
        "#,
        params![
            entry.id, entry.category, entry.difficulty, entry.foreign_language,
            entry.english_text, entry.korean_text,
            audio_type(&entry.english_audio), audio_uri(&entry.english_audio),
            audio_type(&entry.korean_audio), audio_uri(&entry.korean_audio),
            entry.japanese_text, audio_type(&entry.japanese_audio), audio_uri(&entry.japanese_audio),
            entry.chinese_text, audio_type(&entry.chinese_audio), audio_uri(&entry.chinese_audio),
            entry.model_korean, entry.model_english, entry.model_japanese, entry.model_chinese,
            serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".to_string()),
            entry.duration_seconds, entry.notes
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_all_sentences(app: tauri::AppHandle, foreign_language: Option<String>) -> Result<Vec<SentenceEntry>, String> {
    let db = conn(&app)?;
    let sql = if foreign_language.is_some() {
        "SELECT * FROM sentences WHERE is_draft = 0 AND foreign_language = ? ORDER BY category, difficulty, id"
    } else {
        "SELECT * FROM sentences WHERE is_draft = 0 ORDER BY category, difficulty, id"
    };
    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
    let rows = if let Some(lang) = foreign_language {
        stmt.query_map(params![lang], row_to_sentence).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
    } else {
        stmt.query_map([], row_to_sentence).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
    };
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_sentence(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = conn(&app)?;
    db.execute("DELETE FROM sentences WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn schedule_review(app: tauri::AppHandle, sentence_id: String, direction: String, interval_days: i64, now: i64) -> Result<(), String> {
    let db = conn(&app)?;
    let next = now + interval_days * 24 * 60 * 60 * 1000;
    db.execute(
        r#"
        INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at, first_studied_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(sentence_id, direction) DO UPDATE SET
          next_review_date = excluded.next_review_date,
          interval_days = excluded.interval_days,
          review_count = review_count + 1,
          last_studied_at = excluded.last_studied_at
        "#,
        params![sentence_id, direction, next, interval_days, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_result(app: tauri::AppHandle, result: SessionResult) -> Result<(), String> {
    let db = conn(&app)?;
    db.execute(
        r#"
        INSERT OR REPLACE INTO session_results
        (id, sentence_id, direction, timestamp, interp_recording_uri, back_interp_recording_uri, back_interp_text, original_text, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        params![
            result.id, result.sentence_id, result.direction, result.timestamp,
            result.interp_recording_uri, result.back_interp_recording_uri,
            result.back_interp_text, result.original_text, result.notes
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_results(app: tauri::AppHandle, limit: i64) -> Result<Vec<SessionResult>, String> {
    let db = conn(&app)?;
    let mut stmt = db.prepare("SELECT * FROM session_results ORDER BY timestamp DESC LIMIT ?").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(SessionResult {
            id: row.get("id")?,
            sentence_id: row.get("sentence_id")?,
            direction: row.get("direction")?,
            timestamp: row.get("timestamp")?,
            interp_recording_uri: row.get("interp_recording_uri")?,
            back_interp_recording_uri: row.get("back_interp_recording_uri")?,
            back_interp_text: row.get("back_interp_text")?,
            original_text: row.get("original_text")?,
            notes: row.get("notes")?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProgressInfo {
    interval_days: i64,
}

#[tauri::command]
fn get_progress(app: tauri::AppHandle, sentence_id: String, direction: String) -> Result<Option<ProgressInfo>, String> {
    let db = conn(&app)?;
    db.query_row(
        "SELECT interval_days FROM sentence_progress WHERE sentence_id = ? AND direction = ?",
        params![sentence_id, direction],
        |row| Ok(ProgressInfo { interval_days: row.get(0)? }),
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_practice_queue(app: tauri::AppHandle, foreign_language: String, direction: String, category: Option<String>, daily_new_limit: i64) -> Result<Vec<QueueItem>, String> {
    let db = conn(&app)?;
    let now = chrono_like_now();
    let mut queue = Vec::new();
    {
        let mut stmt = db.prepare(
            r#"
            SELECT s.*, sp.direction as sp_direction
            FROM sentence_progress sp
            JOIN sentences s ON s.id = sp.sentence_id
            WHERE sp.next_review_date <= ? AND s.is_draft = 0 AND s.foreign_language = ?
            ORDER BY sp.next_review_date ASC
            "#,
        ).map_err(|e| e.to_string())?;
        let due = stmt.query_map(params![now, foreign_language], |row| {
            Ok(QueueItem { sentence: row_to_sentence(row)?, direction: row.get("sp_direction")? })
        }).map_err(|e| e.to_string())?;
        for item in due {
            queue.push(item.map_err(|e| e.to_string())?);
        }
    }
    let today_start = now - (now % 86_400_000);
    let studied: i64 = db.query_row(
        "SELECT COUNT(DISTINCT sentence_id) FROM sentence_progress WHERE first_studied_at >= ?",
        params![today_start],
        |row| row.get(0),
    ).unwrap_or(0);
    let remaining = (daily_new_limit - studied).max(0);
    if remaining > 0 {
        let mut sql = String::from(
            "SELECT s.* FROM sentences s LEFT JOIN sentence_progress sp ON s.id = sp.sentence_id AND sp.direction = ? WHERE sp.sentence_id IS NULL AND s.is_draft = 0 AND s.foreign_language = ?"
        );
        if category.is_some() {
            sql.push_str(" AND s.category = ?");
        }
        if direction.starts_with("ko-") {
            sql.push_str(" AND s.korean_text IS NOT NULL");
        }
        sql.push_str(" ORDER BY s.difficulty ASC, s.id ASC LIMIT ?");
        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = if let Some(cat) = category {
            stmt.query_map(params![direction, foreign_language, cat, remaining], row_to_sentence).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
        } else {
            stmt.query_map(params![direction, foreign_language, remaining], row_to_sentence).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
        }.map_err(|e| e.to_string())?;
        queue.extend(rows.into_iter().map(|sentence| QueueItem { sentence, direction: direction.clone() }));
    }
    Ok(queue)
}

fn chrono_like_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
fn speak_text(text: String, language: String, speed: f64) -> Result<(), String> {
    let culture = match language.as_str() {
        s if s.starts_with("en") => "en-US",
        s if s.starts_with("ko") => "ko-KR",
        s if s.starts_with("ja") => "ja-JP",
        s if s.starts_with("zh") => "zh-CN",
        _ => "en-US",
    };
    // SAPI rate: -10(slow)~+10(fast), 1.0 speed → 0
    let rate = ((speed - 1.0) * 5.0).round() as i32;
    let rate = rate.clamp(-5, 5);
    let safe_text = text.replace('\'', " ").replace('"', " ").replace('`', " ").replace('$', "");
    let script = format!(
        "Add-Type -AssemblyName System.Speech; \
         $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
         try {{ $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, \
           [System.Speech.Synthesis.VoiceAge]::NotSet, 0, \
           [System.Globalization.CultureInfo]::GetCultureInfo('{culture}')) }} catch {{}}; \
         $s.Rate = {rate}; $s.Speak('{text}')",
        culture = culture,
        rate = rate,
        text = safe_text,
    );
    std::thread::spawn(move || {
        let _ = std::process::Command::new("powershell")
            .args(["-WindowStyle", "Hidden", "-NonInteractive", "-Command", &script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn();
    });
    Ok(())
}

#[tauri::command]
fn start_stt(language: String) -> Result<String, String> {
    Ok(format!("STT adapter placeholder: Vosk streaming recognizer requested for {language}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_db,
            get_all_settings,
            set_setting,
            get_string_setting,
            set_string_setting,
            upsert_sentence,
            get_all_sentences,
            delete_sentence,
            get_progress,
            schedule_review,
            save_result,
            get_results,
            get_practice_queue,
            speak_text,
            start_stt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
