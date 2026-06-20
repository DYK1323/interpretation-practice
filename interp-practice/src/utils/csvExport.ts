import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getDB } from "../db/schema";
import type { SentenceEntry } from "../types";

const HEADERS = [
  "id", "category", "difficulty", "foreignLanguage",
  "englishText", "koreanText",
  "englishAudioType", "koreanAudioType",
  "englishAudioUri", "koreanAudioUri",
  "japaneseText", "japaneseAudioType", "japaneseAudioUri",
  "chineseText", "chineseAudioType", "chineseAudioUri",
  "modelKorean", "modelEnglish", "modelJapanese", "modelChinese",
  "tags", "notes",
  "enkoNextReviewDate", "enkoIntervalDays", "enkoReviewCount", "enkoLastStudiedAt",
  "koenNextReviewDate", "koenIntervalDays", "koenReviewCount", "koenLastStudiedAt",
  "jakoNextReviewDate", "jakoIntervalDays", "jakoReviewCount", "jakoLastStudiedAt",
  "kojaNextReviewDate", "kojaIntervalDays", "kojaReviewCount", "kojaLastStudiedAt",
  "zhkoNextReviewDate", "zhkoIntervalDays", "zhkoReviewCount", "zhkoLastStudiedAt",
  "kozhNextReviewDate", "kozhIntervalDays", "kozhReviewCount", "kozhLastStudiedAt",
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
  const ja = resolveAudio(row.japanese_audio_type, row.japanese_audio_uri);
  const zh = resolveAudio(row.chinese_audio_type, row.chinese_audio_uri);
  const tags = (() => {
    try { return (JSON.parse(row.tags ?? "[]") as string[]).join("|"); } catch { return ""; }
  })();

  return [
    escape(row.id),
    escape(row.category),
    String(row.difficulty ?? 2),
    escape(row.foreign_language ?? "en"),
    escape(row.english_text),
    escape(row.korean_text),
    escape(en.type),
    escape(ko.type),
    escape(en.uri),
    escape(ko.uri),
    escape(row.japanese_text),
    escape(ja.type),
    escape(ja.uri),
    escape(row.chinese_text),
    escape(zh.type),
    escape(zh.uri),
    escape(row.model_korean),
    escape(row.model_english),
    escape(row.model_japanese),
    escape(row.model_chinese),
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
    escape(row.jako_next_review_date),
    escape(row.jako_interval_days),
    escape(row.jako_review_count),
    escape(row.jako_last_studied_at),
    escape(row.koja_next_review_date),
    escape(row.koja_interval_days),
    escape(row.koja_review_count),
    escape(row.koja_last_studied_at),
    escape(row.zhko_next_review_date),
    escape(row.zhko_interval_days),
    escape(row.zhko_review_count),
    escape(row.zhko_last_studied_at),
    escape(row.kozh_next_review_date),
    escape(row.kozh_interval_days),
    escape(row.kozh_review_count),
    escape(row.kozh_last_studied_at),
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
      sp2.last_studied_at   AS koen_last_studied_at,
      sp3.next_review_date  AS jako_next_review_date,
      sp3.interval_days     AS jako_interval_days,
      sp3.review_count      AS jako_review_count,
      sp3.last_studied_at   AS jako_last_studied_at,
      sp4.next_review_date  AS koja_next_review_date,
      sp4.interval_days     AS koja_interval_days,
      sp4.review_count      AS koja_review_count,
      sp4.last_studied_at   AS koja_last_studied_at,
      sp5.next_review_date  AS zhko_next_review_date,
      sp5.interval_days     AS zhko_interval_days,
      sp5.review_count      AS zhko_review_count,
      sp5.last_studied_at   AS zhko_last_studied_at,
      sp6.next_review_date  AS kozh_next_review_date,
      sp6.interval_days     AS kozh_interval_days,
      sp6.review_count      AS kozh_review_count,
      sp6.last_studied_at   AS kozh_last_studied_at
    FROM sentences s
    LEFT JOIN sentence_progress sp1 ON s.id = sp1.sentence_id AND sp1.direction = 'en-ko'
    LEFT JOIN sentence_progress sp2 ON s.id = sp2.sentence_id AND sp2.direction = 'ko-en'
    LEFT JOIN sentence_progress sp3 ON s.id = sp3.sentence_id AND sp3.direction = 'ja-ko'
    LEFT JOIN sentence_progress sp4 ON s.id = sp4.sentence_id AND sp4.direction = 'ko-ja'
    LEFT JOIN sentence_progress sp5 ON s.id = sp5.sentence_id AND sp5.direction = 'zh-ko'
    LEFT JOIN sentence_progress sp6 ON s.id = sp6.sentence_id AND sp6.direction = 'ko-zh'
    ORDER BY s.id
  `);

  const csv = [HEADERS, ...rows.map(rowToCSV)].join("\n");

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const file = new File(Paths.document, `sentences_export_${dateStr}.csv`);
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
