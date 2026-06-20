# 통역 연습

통역사를 위한 연습 도구입니다. 모바일 앱(iOS/Android)과 Windows 데스크톱 앱을 제공합니다.

---

## 앱 구성

| 앱 | 플랫폼 | 디렉토리 |
|---|---|---|
| 모바일 앱 | iOS / Android | `interp-practice/` |
| 데스크톱 앱 | Windows | `desktop-app/` |

---

## 주요 기능

- **라이브러리** — 연습용 텍스트 문장 관리
- **연습 세션** — 음성 녹음 및 실시간 STT(음성 인식)로 통역 연습
- **기록** — 과거 세션 열람
- **Google Sheets 동기화** — 라이브러리 데이터를 Google Sheets와 양방향 동기화

---

## 모바일 앱

**스택:** React Native · Expo 56 · Expo Router · SQLite · Zustand

### 개발 환경 실행

```bash
cd interp-practice
npm install
npm start         # Expo dev server
npm run android   # Android
npm run ios       # iOS
```

### 빌드 (EAS)

```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

---

## 데스크톱 앱 (Windows)

**스택:** React 19 · Tauri 2 · Vite · TypeScript

### 개발 환경 실행

```bash
cd desktop-app
npm install
npm run tauri dev
```

### 프로덕션 빌드

```bash
npm run tauri build
# 결과물: src-tauri/target/release/bundle/nsis/통역 연습_x.x.x_x64-setup.exe
```

### 다운로드

[GitHub Releases](../../releases)에서 최신 인스톨러(`.exe`와 '.apk')를 다운로드할 수 있습니다.

**요구 사항:** Windows 10/11 (64-bit)

---

## Google Sheets 동기화 설정

앱 내 **설정 → 동기화** 화면에서 Apps Script URL을 입력하면 Google Sheets와 연동됩니다.

---

## 라이선스

MIT
