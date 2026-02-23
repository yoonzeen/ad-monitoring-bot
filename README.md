# 광고 모니터링 봇 (브라우저 기반) + 대시보드

이 프로젝트는 **실제 브라우저(Playwright/Chromium)** 환경에서 페이지를 열어 광고/태그 관련 이상을 감지하고, 그 결과를 `monitor-report.json`로 저장한 뒤 **웹 페이지(대시보드)** 에서 “이상 없음 / 고쳐야 할 항목”으로 보여줍니다.

또한 GitHub Actions의 **cron 스케줄(매 1시간)** 로 자동 실행할 수 있고, 원하면 GitHub Pages로 대시보드를 배포해 **항상 최신 결과**를 확인할 수 있습니다.

## 무엇을 감지하나

- **HTTP 상태 코드 이상**
- **문자열 포함/미포함 규칙** (예: 특정 광고 스크립트가 들어갔는지)
- **JS 런타임 에러**: `pageerror`
- **콘솔 에러/경고**: `console`의 `error`/`warning`
- **네트워크 실패**: `requestfailed` (기본은 “수집”만 하고 실패로 보진 않음)

## 로컬 실행

### 1) 설치

```bash
npm ci
```

Playwright 브라우저(Chromium)는 최초 1회 설치가 필요할 수 있습니다.

```bash
npx playwright install chromium
```

### 2) `.env` 설정 (권장)

`.env.example`을 `.env`로 복사해 값만 바꿉니다.

- `MONITOR_TARGET_URL`: 모니터링할 URL (필수)

그리고 실행합니다.

```bash
npm run monitor
```

성공/실패에 따라 `public/monitor-report.json`이 갱신됩니다.

### 3) 웹(대시보드)에서 결과 보기

개발 서버를 켭니다.

```bash
npm run dev
```

페이지를 열면 `/monitor-report.json`을 읽어 다음을 표시합니다.

- 정상: **이상 없음**
- 이상: **고쳐야 할 항목** + (펼쳐보기) JS/콘솔/네트워크 상세

## 환경변수(옵션)

자세한 기본값은 `.env.example`을 참고하세요.

- **`MONITOR_FAIL_ON_PAGEERROR`**: JS 런타임 에러가 있으면 실패 처리 (기본 `true`)
- **`MONITOR_FAIL_ON_CONSOLE_ERROR`**: console error가 있으면 실패 처리 (기본 `true`)
- **`MONITOR_FAIL_ON_REQUEST_FAILED`**: requestfailed가 있으면 실패 처리 (기본 `false`)
- **`MONITOR_IGNORE_ERROR_PATTERNS`**: 무시할 에러 패턴(부분 문자열) 목록 (콤마 구분)
- **`MONITOR_NAV_TIMEOUT_MS`**, **`MONITOR_TIMEOUT_MS`**, **`MONITOR_WAIT_AFTER_LOAD_MS`**

## GitHub Actions (매 1시간)

워크플로 파일: `.github/workflows/ad-monitor.yml`

### 1) Secrets 설정

Repo → Settings → Secrets and variables → Actions → New repository secret

- **`MONITOR_TARGET_URL`** (필수)

### 2) 스케줄

`cron: '0 * * * *'` 으로 **UTC 기준 매시간 정각**에 실행됩니다. (GitHub 스케줄은 약간의 지연이 있을 수 있습니다.)

각 실행은 `public/monitor-report.json`을 아티팩트로 업로드합니다.

## GitHub Pages로 대시보드 배포 (선택)

이 워크플로는 모니터 실행 후 사이트를 빌드/배포하여, 대시보드에서 항상 최신 리포트를 볼 수 있게 합니다.

활성화 방법:

- Repo → **Settings → Pages**
- Source: **GitHub Actions**

## 파일 구조 (핵심)

- **`scripts/monitor.mjs`**: 브라우저 기반 모니터링 실행기(리포트 생성)
- **`public/monitor-report.json`**: 최신 결과(자동 생성/갱신)
- **`src/components/MonitorReportPanel.tsx`**: 리포트 UI 렌더링
- **`.github/workflows/ad-monitor.yml`**: 스케줄 실행 + Pages 배포
