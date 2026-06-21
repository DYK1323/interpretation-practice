#!/usr/bin/env node
/**
 * 릴리즈 시 latest.json 생성 스크립트
 *
 * 사용법:
 *   node scripts/gen-latest-json.mjs <version> <.sig파일경로> <다운로드URL> [릴리즈노트]
 *
 * 예시:
 *   node scripts/gen-latest-json.mjs 1.0.2 \
 *     ./target/release/bundle/nsis/interpretation-practice-desktop_1.0.2_x64-setup.exe.sig \
 *     "https://github.com/DYK1323/interpretation-practice/releases/download/v1.0.2/interpretation-practice-desktop_1.0.2_x64-setup.exe" \
 *     "버그 수정 및 기능 개선"
 *
 * 생성된 latest.json을 GitHub Release asset으로 업로드하세요.
 */

import { readFileSync, writeFileSync } from "fs";

const [, , version, sigFile, downloadUrl, notes = ""] = process.argv;

if (!version || !sigFile || !downloadUrl) {
  console.error("사용법: node gen-latest-json.mjs <version> <sig파일> <download-url> [notes]");
  process.exit(1);
}

const signature = readFileSync(sigFile, "utf-8").trim();

const payload = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: downloadUrl,
    },
  },
};

writeFileSync("latest.json", JSON.stringify(payload, null, 2) + "\n");
console.log(`✅ latest.json 생성 완료 (v${version})`);
