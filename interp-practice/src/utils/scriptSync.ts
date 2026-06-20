import { importCSVContent } from "./csvImport";
import { generateCSVString } from "./csvExport";

export async function syncFromScript(
  url: string
): Promise<{ imported: number; failed: number }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`가져오기 실패 (HTTP ${response.status})`);
  const content = await response.text();
  return importCSVContent(content);
}

export async function exportToScript(url: string): Promise<number> {
  const { csv, count } = await generateCSVString();
  if (count === 0) throw new Error("내보낼 문장이 없습니다.");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: csv,
  });

  if (!response.ok) throw new Error(`내보내기 실패 (HTTP ${response.status})`);
  return count;
}
