import { describe, expect, it } from "vitest";
import { exportCSVContent, parseCSVContent, toCSVExportUrl } from "./csv";
import { nextReviewDate, stableId } from "./session";
import type { SentenceEntry } from "./types";

describe("CSV UTF-8 import/export", () => {
  it("round-trips Korean, Japanese, and Chinese text", () => {
    const csv = [
      "id,category,difficulty,foreignLanguage,sourceText,koreanText,modelKorean,modelSource,tags,notes",
      "koja,daily,2,ja,来週の会議までに資料を更新します。,다음 주 회의 전까지 자료를 업데이트합니다.,자료를 업데이트해 두겠습니다.,資料を更新しておきます。,회의|자료,한글 메모",
      "kozh,business,3,zh,我们需要在预算范围内完成项目。,예산 범위 안에서 프로젝트를 완료해야 합니다.,예산 안에서 완료해야 합니다.,我们必须在预算内完成项目。,예산|프로젝트,中文 포함",
    ].join("\n");

    const parsed = parseCSVContent(csv);
    expect(parsed.failed).toBe(0);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].entry.japaneseText).toBe("来週の会議までに資料を更新します。");
    expect(parsed.rows[1].entry.chineseText).toBe("我们需要在预算范围内完成项目。");
    expect(parsed.rows[1].entry.koreanText).toBe("예산 범위 안에서 프로젝트를 완료해야 합니다.");
  });

  it("exports UTF-8 content using the mobile-compatible header", () => {
    const rows: SentenceEntry[] = [{
      id: "sample",
      category: "daily",
      difficulty: 1,
      foreignLanguage: "en",
      englishText: "Please summarize today's meeting.",
      koreanText: "오늘 회의를 요약해 주세요.",
      modelKorean: "오늘 회의 내용을 요약해 주세요.",
      tags: ["회의", "요약"],
      notes: "UTF-8 확인",
    }];

    const exported = exportCSVContent(rows);
    expect(exported).toContain("sourceText");
    expect(exported).toContain("오늘 회의를 요약해 주세요.");
    expect(exported).toContain("회의|요약");
  });

  it("supports legacy englishText imports and stable IDs", () => {
    const parsed = parseCSVContent("englishText,koreanText\nHello,안녕하세요");
    expect(parsed.rows[0].entry.id).toBe(stableId("Hello"));
    expect(parsed.rows[0].entry.englishText).toBe("Hello");
  });

  it("converts Google Sheet share links to CSV export URLs", () => {
    expect(toCSVExportUrl("https://docs.google.com/spreadsheets/d/abc-123_X/edit#gid=0"))
      .toBe("https://docs.google.com/spreadsheets/d/abc-123_X/export?format=csv");
  });
});

describe("review scheduling", () => {
  it("uses day intervals in milliseconds", () => {
    const now = Date.UTC(2026, 5, 20);
    expect(nextReviewDate(now, 3)).toBe(now + 3 * 24 * 60 * 60 * 1000);
  });
});
