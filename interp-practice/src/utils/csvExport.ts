import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getAllSentences } from "../db/sentences";
import { getStringSetting, setStringSetting } from "../db/settings";
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

async function writeToDownloads(csv: string): Promise<void> {
  const downloadsUri = StorageAccessFramework.getUriForDirectoryInRoot("Download");

  let dirUri = await getStringSetting("downloadsPermissionUri");

  if (!dirUri) {
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
    if (!result.granted) throw new Error("Downloads 폴더 접근 권한이 필요합니다.");
    dirUri = result.directoryUri;
    await setStringSetting("downloadsPermissionUri", dirUri);
  }

  try {
    const fileUri = await StorageAccessFramework.createFileAsync(dirUri, "sentences_export", "text/csv");
    await StorageAccessFramework.writeAsStringAsync(fileUri, csv);
  } catch {
    // Permission may have been revoked — re-request once
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
    if (!result.granted) throw new Error("Downloads 폴더 접근 권한이 필요합니다.");
    dirUri = result.directoryUri;
    await setStringSetting("downloadsPermissionUri", dirUri);
    const fileUri = await StorageAccessFramework.createFileAsync(dirUri, "sentences_export", "text/csv");
    await StorageAccessFramework.writeAsStringAsync(fileUri, csv);
  }
}

export async function exportCSV(): Promise<number> {
  const sentences = await getAllSentences();
  const csv = [HEADERS, ...sentences.map(entryToRow)].join("\n");

  if (Platform.OS === "android") {
    await writeToDownloads(csv);
  } else {
    const file = new File(Paths.document, "sentences_export.csv");
    if (file.exists) file.delete();
    file.write(csv);
    if (!file.exists) throw new Error("파일 생성에 실패했습니다.");
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "문장 CSV 내보내기",
      UTI: "public.comma-separated-values-text",
    });
  }

  return sentences.length;
}
