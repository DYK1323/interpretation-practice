import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { getDB } from "../db/schema";

const HEADERS = "sentenceId,direction,nextReviewDate,intervalDays,reviewCount,lastStudiedAt";

function escape(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportProgressBackup(): Promise<number> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>("SELECT * FROM sentence_progress ORDER BY sentence_id, direction");

  const lines = rows.map((r) =>
    [
      escape(r.sentence_id),
      escape(r.direction),
      escape(r.next_review_date),
      escape(r.interval_days),
      escape(r.review_count),
      escape(r.last_studied_at),
    ].join(",")
  );

  const csv = [HEADERS, ...lines].join("\n");
  const file = new File(Paths.document, "progress_backup.csv");
  if (file.exists) file.delete();
  file.write(csv);

  if (!file.exists) throw new Error("파일 생성에 실패했습니다.");

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "학습 진도 백업",
    UTI: "public.comma-separated-values-text",
  });

  return rows.length;
}

export async function importProgressBackup(): Promise<{ imported: number; failed: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/plain", "text/comma-separated-values", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { imported: 0, failed: 0 };
  }

  const uri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(uri);

  const [headerLine, ...dataLines] = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const headers = headerLine.split(",").map((h) => h.trim());

  const get = (row: string[], key: string): string => {
    const idx = headers.indexOf(key);
    if (idx < 0) return "";
    return row[idx]?.replace(/^"|"$/g, "").replace(/""/g, '"').trim() ?? "";
  };

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuote) { inQuote = true; continue; }
      if (ch === '"' && inQuote) {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuote = false; }
        continue;
      }
      if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur);
    return fields;
  };

  const db = await getDB();
  let imported = 0;
  let failed = 0;

  await db.withTransactionAsync(async () => {
    for (const line of dataLines) {
      try {
        const row = parseRow(line);
        const sentenceId = get(row, "sentenceId");
        const direction = get(row, "direction");
        const nextReviewDate = parseInt(get(row, "nextReviewDate"), 10);
        const intervalDays = parseInt(get(row, "intervalDays"), 10);
        const reviewCount = parseInt(get(row, "reviewCount"), 10);
        const lastStudiedAt = parseInt(get(row, "lastStudiedAt"), 10);

        if (!sentenceId || !direction) { failed++; continue; }
        if (isNaN(nextReviewDate) || isNaN(intervalDays) || isNaN(reviewCount)) { failed++; continue; }

        await db.runAsync(
          `INSERT INTO sentence_progress (sentence_id, direction, next_review_date, interval_days, review_count, last_studied_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(sentence_id, direction) DO UPDATE SET
             next_review_date = excluded.next_review_date,
             interval_days = excluded.interval_days,
             review_count = excluded.review_count,
             last_studied_at = excluded.last_studied_at`,
          [sentenceId, direction, nextReviewDate, intervalDays, reviewCount, isNaN(lastStudiedAt) ? null : lastStudiedAt]
        );
        imported++;
      } catch {
        failed++;
      }
    }
  });

  return { imported, failed };
}
