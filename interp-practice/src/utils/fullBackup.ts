import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { getAllSentences } from "../db/sentences";
import { getDB } from "../db/schema";
import type { SentenceEntry, Category } from "../types";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escape(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuote) { inQuote = true; continue; }
    if (ch === '"' && inQuote) {
      if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuote = false; }
      continue;
    }
    if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

// ─── Sentences section ────────────────────────────────────────────────────────

const SENTENCE_HEADERS = "id,category,difficulty,englishText,koreanText,englishAudioType,koreanAudioType,englishAudioUri,koreanAudioUri,modelKorean,modelEnglish,tags,notes";

function resolveAudio(audio: SentenceEntry["englishAudio"] | SentenceEntry["koreanAudio"]) {
  if (audio?.type === "file" && audio.uri.startsWith("file://")) {
    return { type: "tts", uri: "" };
  }
  return { type: audio?.type ?? "tts", uri: audio?.type === "file" ? audio.uri : "" };
}

function sentenceToRow(e: SentenceEntry): string {
  const en = resolveAudio(e.englishAudio);
  const ko = resolveAudio(e.koreanAudio);
  return [
    escape(e.id),
    escape(e.category),
    String(e.difficulty),
    escape(e.englishText),
    escape(e.koreanText),
    escape(en.type),
    escape(ko.type),
    escape(en.uri),
    escape(ko.uri),
    escape(e.modelKorean),
    escape(e.modelEnglish),
    escape(e.tags.join("|")),
    escape(e.notes),
  ].join(",");
}

// ─── Progress section ─────────────────────────────────────────────────────────

const PROGRESS_HEADERS = "sentenceId,direction,nextReviewDate,intervalDays,reviewCount,lastStudiedAt";

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportFullBackup(): Promise<{ sentences: number; progress: number }> {
  const sentences = await getAllSentences();
  const db = await getDB();
  const progressRows = await db.getAllAsync<any>(
    "SELECT * FROM sentence_progress ORDER BY sentence_id, direction"
  );

  const sentenceLines = [SENTENCE_HEADERS, ...sentences.map(sentenceToRow)].join("\n");
  const progressLines = [
    PROGRESS_HEADERS,
    ...progressRows.map((r) =>
      [
        escape(r.sentence_id),
        escape(r.direction),
        escape(r.next_review_date),
        escape(r.interval_days),
        escape(r.review_count),
        escape(r.last_studied_at),
      ].join(",")
    ),
  ].join("\n");

  const csv = `[SENTENCES]\n${sentenceLines}\n[PROGRESS]\n${progressLines}`;

  const file = new File(Paths.document, "interp_backup.csv");
  if (file.exists) file.delete();
  file.write(csv);
  if (!file.exists) throw new Error("파일 생성에 실패했습니다.");

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "전체 백업 내보내기",
    UTI: "public.comma-separated-values-text",
  });

  return { sentences: sentences.length, progress: progressRows.length };
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importFullBackup(): Promise<{
  sentences: number;
  progress: number;
  failed: number;
  canceled: boolean;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/plain", "text/comma-separated-values", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { sentences: 0, progress: 0, failed: 0, canceled: true };
  }

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);

  // Split into sections
  const sentenceSection = extractSection(content, "SENTENCES");
  const progressSection = extractSection(content, "PROGRESS");

  const db = await getDB();
  let sentenceCount = 0;
  let progressCount = 0;
  let failed = 0;

  await db.withTransactionAsync(async () => {
    // Import sentences
    if (sentenceSection) {
      const lines = sentenceSection.split(/\r?\n/).filter(Boolean);
      if (lines.length >= 2) {
        const headers = parseCSVLine(lines[0]);
        const keepDifficulty = !headers.includes("difficulty");
        for (let i = 1; i < lines.length; i++) {
          try {
            const cols = parseCSVLine(lines[i]);
            const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";
            const englishText = get("englishText");
            if (!englishText) { failed++; continue; }

            const id = get("id") || stableId(englishText);
            const tagsRaw = get("tags");
            const tags = tagsRaw
              ? tagsRaw.includes("|")
                ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
                : tagsRaw.split(/\s+/).filter(Boolean)
              : [];

            const diffRaw = parseInt(get("difficulty"), 10);
            const difficulty = [1, 2, 3].includes(diffRaw) ? diffRaw : null;
            const diffParam = keepDifficulty ? null : difficulty;

            const enType = get("englishAudioType") || "tts";
            const koType = get("koreanAudioType") || "tts";

            await db.runAsync(
              `INSERT INTO sentences (
                id, category, difficulty, english_text, korean_text,
                english_audio_type, english_audio_uri,
                korean_audio_type, korean_audio_uri,
                model_korean, model_english, tags, duration_seconds, notes
              ) VALUES (?, ?, COALESCE(?, 2), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                notes = excluded.notes`,
              [
                id, (get("category") as Category) || "daily", diffParam,
                englishText, get("koreanText") || null,
                enType, enType === "file" ? get("englishAudioUri") || null : null,
                koType, koType === "file" ? get("koreanAudioUri") || null : null,
                get("modelKorean") || null, get("modelEnglish") || null,
                JSON.stringify(tags), null, get("notes") || null,
              ]
            );
            sentenceCount++;
          } catch {
            failed++;
          }
        }
      }
    }

    // Import progress
    if (progressSection) {
      const lines = progressSection.split(/\r?\n/).filter(Boolean);
      if (lines.length >= 2) {
        const headers = parseCSVLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          try {
            const cols = parseCSVLine(lines[i]);
            const get = (key: string) => cols[headers.indexOf(key)]?.trim() ?? "";
            const sentenceId = get("sentenceId");
            const direction = get("direction");
            const nextReviewDate = parseInt(get("nextReviewDate"), 10);
            const intervalDays = parseInt(get("intervalDays"), 10);
            const reviewCount = parseInt(get("reviewCount"), 10);
            const lastStudiedAt = parseInt(get("lastStudiedAt"), 10);

            if (!sentenceId || !direction || isNaN(nextReviewDate) || isNaN(intervalDays)) {
              failed++; continue;
            }

            await db.runAsync(
              `INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(sentence_id, direction) DO UPDATE SET
                 next_review_date = excluded.next_review_date,
                 interval_days = excluded.interval_days,
                 review_count = excluded.review_count,
                 last_studied_at = excluded.last_studied_at`,
              [sentenceId, direction, nextReviewDate, intervalDays,
               isNaN(reviewCount) ? 0 : reviewCount,
               isNaN(lastStudiedAt) ? null : lastStudiedAt]
            );
            progressCount++;
          } catch {
            failed++;
          }
        }
      }
    }
  });

  return { sentences: sentenceCount, progress: progressCount, failed, canceled: false };
}

function extractSection(content: string, name: string): string | null {
  const startMarker = `[${name}]`;
  const start = content.indexOf(startMarker);
  if (start < 0) return null;
  const afterStart = content.indexOf("\n", start) + 1;

  // find next section or end of file
  const nextSection = content.indexOf("\n[", afterStart);
  const section = nextSection < 0
    ? content.slice(afterStart)
    : content.slice(afterStart, nextSection);
  return section.trim() || null;
}

function stableId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return "auto_" + Math.abs(hash).toString(16).padStart(8, "0");
}
