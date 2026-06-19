import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getAllSentences } from "../db/sentences";
import type { SentenceEntry } from "../types";

const HEADERS = "id,category,difficulty,englishText,koreanText,englishAudioType,koreanAudioType,englishAudioUri,koreanAudioUri,modelKorean,modelEnglish,tags";

function escape(val: string | undefined | null): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function entryToRow(e: SentenceEntry): string {
  return [
    escape(e.id),
    escape(e.category),
    String(e.difficulty),
    escape(e.englishText),
    escape(e.koreanText),
    escape(e.englishAudio?.type ?? "tts"),
    escape(e.koreanAudio?.type ?? "tts"),
    escape(e.englishAudio?.type === "file" ? e.englishAudio.uri : ""),
    escape(e.koreanAudio?.type === "file" ? e.koreanAudio.uri : ""),
    escape(e.modelKorean),
    escape(e.modelEnglish),
    escape(e.tags.join("|")),
  ].join(",");
}

export async function exportCSV(): Promise<number> {
  const sentences = await getAllSentences();
  const csv = [HEADERS, ...sentences.map(entryToRow)].join("\n");

  const file = new File(Paths.document, "sentences_export.csv");
  if (file.exists) file.delete();
  file.write(csv);

  if (!file.exists) throw new Error("파일 생성에 실패했습니다.");

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/plain",
      dialogTitle: "문장 CSV 내보내기",
    });
  }

  return sentences.length;
}
