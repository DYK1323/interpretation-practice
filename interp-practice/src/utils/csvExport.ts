import { Share } from "react-native";
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

  await Share.share({ message: csv, title: "sentences_export.csv" });

  return sentences.length;
}
