import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getDB } from "../db/schema";

const HEADERS = [
  "id", "category", "difficulty", "foreignLanguage",
  "sourceText", "koreanText",
  "sourceAudioType", "sourceAudioUri",
  "koreanAudioType", "koreanAudioUri",
  "modelKorean", "modelSource",
  "tags", "notes",
  "fwdNextReviewDate", "fwdIntervalDays", "fwdReviewCount", "fwdLastStudiedAt",
  "bwdNextReviewDate", "bwdIntervalDays", "bwdReviewCount", "bwdLastStudiedAt",
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
  const fl: string = row.foreign_language ?? "en";

  let sourceText: string;
  let srcAudio: { type: string; uri: string };
  let modelSource: string;

  if (fl === "ja") {
    sourceText = row.japanese_text ?? "";
    srcAudio = resolveAudio(row.japanese_audio_type, row.japanese_audio_uri);
    modelSource = row.model_japanese ?? "";
  } else if (fl === "zh") {
    sourceText = row.chinese_text ?? "";
    srcAudio = resolveAudio(row.chinese_audio_type, row.chinese_audio_uri);
    modelSource = row.model_chinese ?? "";
  } else {
    sourceText = row.english_text ?? "";
    srcAudio = resolveAudio(row.english_audio_type, row.english_audio_uri);
    modelSource = row.model_english ?? "";
  }

  const ko = resolveAudio(row.korean_audio_type, row.korean_audio_uri);

  const fwdNRD = fl === "ja" ? row.jako_nrd : fl === "zh" ? row.zhko_nrd : row.enko_nrd;
  const fwdID  = fl === "ja" ? row.jako_id  : fl === "zh" ? row.zhko_id  : row.enko_id;
  const fwdRC  = fl === "ja" ? row.jako_rc  : fl === "zh" ? row.zhko_rc  : row.enko_rc;
  const fwdLS  = fl === "ja" ? row.jako_ls  : fl === "zh" ? row.zhko_ls  : row.enko_ls;

  const bwdNRD = fl === "ja" ? row.koja_nrd : fl === "zh" ? row.kozh_nrd : row.koen_nrd;
  const bwdID  = fl === "ja" ? row.koja_id  : fl === "zh" ? row.kozh_id  : row.koen_id;
  const bwdRC  = fl === "ja" ? row.koja_rc  : fl === "zh" ? row.kozh_rc  : row.koen_rc;
  const bwdLS  = fl === "ja" ? row.koja_ls  : fl === "zh" ? row.kozh_ls  : row.koen_ls;

  const tags = (() => {
    try { return (JSON.parse(row.tags ?? "[]") as string[]).join("|"); } catch { return ""; }
  })();

  return [
    escape(row.id),
    escape(row.category),
    String(row.difficulty ?? 2),
    escape(fl),
    escape(sourceText),
    escape(row.korean_text),
    escape(srcAudio.type),
    escape(srcAudio.uri),
    escape(ko.type),
    escape(ko.uri),
    escape(row.model_korean),
    escape(modelSource),
    escape(tags),
    escape(row.notes),
    escape(fwdNRD), escape(fwdID), escape(fwdRC), escape(fwdLS),
    escape(bwdNRD), escape(bwdID), escape(bwdRC), escape(bwdLS),
  ].join(",");
}

export async function exportCSV(): Promise<number> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(`
    SELECT s.*,
      sp1.next_review_date AS enko_nrd, sp1.interval_days AS enko_id,
      sp1.review_count     AS enko_rc,  sp1.last_studied_at AS enko_ls,
      sp2.next_review_date AS koen_nrd, sp2.interval_days AS koen_id,
      sp2.review_count     AS koen_rc,  sp2.last_studied_at AS koen_ls,
      sp3.next_review_date AS jako_nrd, sp3.interval_days AS jako_id,
      sp3.review_count     AS jako_rc,  sp3.last_studied_at AS jako_ls,
      sp4.next_review_date AS koja_nrd, sp4.interval_days AS koja_id,
      sp4.review_count     AS koja_rc,  sp4.last_studied_at AS koja_ls,
      sp5.next_review_date AS zhko_nrd, sp5.interval_days AS zhko_id,
      sp5.review_count     AS zhko_rc,  sp5.last_studied_at AS zhko_ls,
      sp6.next_review_date AS kozh_nrd, sp6.interval_days AS kozh_id,
      sp6.review_count     AS kozh_rc,  sp6.last_studied_at AS kozh_ls
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
