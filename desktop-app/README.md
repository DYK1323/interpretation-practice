# 통역 연습 데스크톱

`interp-practice` 모바일 앱을 건드리지 않고 별도 폴더에 구현한 데스크톱 앱입니다.
모든 소스와 CSV 처리는 UTF-8을 기준으로 합니다.

## 실행

```powershell
npm install
npm run dev
```

브라우저 미리보기: `http://127.0.0.1:1420`

Tauri 패키징은 Rust/Cargo 설치 후 가능합니다.

```powershell
npm run tauri dev
npm run tauri build
```

## 구현된 기능

- 연습 홈: 학습 언어, 방향, 카테고리, 일일 신규 제한, 셔플 기반 큐 생성
- 3단계 세션: 듣기/통역 녹음, 역통역 녹음, 원문/모범통역/역통역 비교, 메모, 난이도별 복습 예약
- 라이브러리: 문장 목록, 검색, 추가/편집/삭제, 즉시 연습
- 히스토리: 완료 세션 목록과 메모 표시
- 설정: 학습 언어, TTS 속도, 셔플, 원문 표시, 일일 신규 제한
- CSV/Google Sheets: 모바일 앱과 같은 헤더로 UTF-8 import/export, 공개 Google Sheet CSV export URL 동기화
- SQLite: Tauri 백엔드에 모바일 앱과 같은 테이블 스키마 구현

## 음성 엔진

- TTS 기본 어댑터: eSpeak NG 또는 브라우저 `speechSynthesis`
- TTS 고품질 옵션: XTTS-v2 sidecar를 붙일 수 있도록 Tauri 명령 표면 분리
- STT 기본 어댑터: Vosk sidecar를 붙일 수 있도록 Tauri 명령 표면 분리

현재 저장소에는 Vosk 모델, eSpeak NG, XTTS-v2 모델 파일을 번들하지 않았습니다. 배포 단계에서 아래 중 하나를 선택합니다.

1. 설치형: 사용자가 `espeak-ng`, `python`, `vosk`, 언어별 Vosk 모델을 설치
2. 번들형: 앱 `resources/voice/` 아래에 엔진 바이너리와 모델을 포함
3. 첫 실행 다운로드형: 설정 화면에서 모델 다운로드 및 경로 지정

필수 클라우드 API 키는 없습니다.

비공개 Google Sheet 동기화가 필요할 때만 Google Cloud 프로젝트, Sheets API, OAuth client 발급이 필요합니다.

## 검증

```powershell
npm test
npm run build
```

현재 테스트는 UTF-8 CSV 왕복, legacy CSV import, Google Sheet URL 변환, 복습 날짜 계산을 검증합니다.
