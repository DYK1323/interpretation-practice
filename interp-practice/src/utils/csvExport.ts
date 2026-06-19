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

function resolveAudio(audio: SentenceEntry["englishAudio"] | SentenceEntry["koreanAudio"]) {
  // Local device recordings can't transfer between devices — export as tts
  if (audio?.type === "file" && audio.uri.startsWith("file://")) {
    return { type: "tts", uri: "" };
  }
  return { type: audio?.type ?? "tts", uri: audio?.type === "file" ? audio.uri : "" };
}

function entryToRow(e: SentenceEntry): string {
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
  ].join(",");
}

export async function exportCSV(): Promise<number> {
  const sentences = await getAllSentences();
  const csv = [HEADERS, ...sentences.map(entryToRow)].join("\n");

  const file = new File(Paths.document, "sentences_export.csv");
  if (file.exists) file.delete();
  file.write(csv);

  if (!file.exists) throw new Error("파일 생성에 실패했습니다.");

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "문장 CSV 내보내기",
    UTI: "public.comma-separated-values-text",
  });

  return sentences.length;
}
