import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getDB } from "../db/schema";
import type { SentenceEntry } from "../types";

const HEADERS = [
  "id", "category", "difficulty",
  "englishText", "koreanText",
  "englishAudioType", "koreanAudioType",
  "englishAudioUri", "koreanAudioUri",
  "modelKorean", "modelEnglish", "tags", "notes",
  "enkoNextReviewDate", "enkoIntervalDays", "enkoReviewCount", "enkoLastStudiedAt",
  "koenNextReviewDate", "koenIntervalDays", "koenReviewCount", "koenLastStudiedAt",
].join(",");

function escape(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function resolveAudio(type: string | null, uri: string | null) {
  if (type === "file" && uri?.startsWith("file://")) {
    return { type: "tts", uri: "" };
  }
  return { type: type ?? "tts", uri: type === "file" ? (uri ?? "") : "" };
}

function rowToCSV(row: any): string {
  const en = resolveAudio(row.english_audio_type, row.english_audio_uri);
  const ko = resolveAudio(row.korean_audio_type, row.korean_audio_uri);
  const tags = (() => {
    try { return (JSON.parse(row.tags ?? "[]") as string[]).join("|"); } catch { return ""; }
  })();

  return [
    escape(row.id),
    escape(row.category),
    String(row.difficulty ?? 2),
    escape(row.english_text),
    escape(row.korean_text),
    escape(en.type),
    escape(ko.type),
    escape(en.uri),
    escape(ko.uri),
    escape(row.model_korean),
    escape(row.model_english),
    escape(tags),
    escape(row.notes),
    escape(row.enko_next_review_date),
    escape(row.enko_interval_days),
    escape(row.enko_review_count),
    escape(row.enko_last_studied_at),
    escape(row.koen_next_review_date),
    escape(row.koen_interval_days),
    escape(row.koen_review_count),
    escape(row.koen_last_studied_at),
  ].join(",");
}

export async function exportCSV(): Promise<number> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(`
    SELECT s.*,
      sp1.next_review_date  AS enko_next_review_date,
      sp1.interval_days     AS enko_interval_days,
      sp1.review_count      AS enko_review_count,
      sp1.last_studied_at   AS enko_last_studied_at,
      sp2.next_review_date  AS koen_next_review_date,
      sp2.interval_days     AS koen_interval_days,
      sp2.review_count      AS koen_review_count,
      sp2.last_studied_at   AS koen_last_studied_at
    FROM sentences s
    LEFT JOIN sentence_progress sp1 ON s.id = sp1.sentence_id AND sp1.direction = 'en-ko'
    LEFT JOIN sentence_progress sp2 ON s.id = sp2.sentence_id AND sp2.direction = 'ko-en'
    ORDER BY s.id
  `);

  const csv = [HEADERS, ...rows.map(rowToCSV)].join("\n");

  const file = new File(Paths.document, "sentences_export.csv");
  if (file.exists) file.delete();
  file.write(csv);
  if (!file.exists) throw new Error("파일 생성에 실패했습니다.");

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "문장 CSV 내보내기",
    UTI: "public.comma-separated-values-text",
  });

  return rows.length;
}
