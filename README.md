# 광고 모니터링 봇 (Playwright) + 대시보드 (Vite/React)

이 레포는 **실제 브라우저(Playwright/Chromium)** 로 페이지를 열어 상태를 점검하고, 결과를 `public/monitor-report.json`로 저장합니다.  
대시보드(React)는 이 JSON을 읽어 “이상 없음 / 이상 감지 / 고쳐야 할 항목”을 웹에서 확인할 수 있게 합니다.

- **모니터 실행기**: `scripts/monitor.js` (`npm run monitor`)
- **대시보드**: Vite + React (`npm run dev` / `npm run build`)
- **결과 파일**: `public/monitor-report.json` (Vite 빌드 시 `dist/`로 복사됨)

## 무엇을 감지하나

- **HTTP 상태 코드**: 2xx가 아니면 실패로 기록
- **JS 런타임 에러**: `pageerror` 이벤트 수집 (옵션에 따라 실패 처리)
- **콘솔 에러/경고**: `console`의 `error`/`warning` 수집 (옵션에 따라 실패 처리)
- **네트워크 실패**: `requestfailed` 수집 (옵션에 따라 실패 처리)

## 빠른 시작 (로컬)

> Node.js **20 이상**이 필요합니다. (CI도 Node 20 기준)

### 1) 설치

```bash
npm ci
```

Playwright 브라우저(Chromium)는 최초 1회 설치가 필요할 수 있습니다.

```bash
npx playwright install chromium
```

### 2) `.env` 설정

`.env.example`을 `.env`로 복사 후 최소 `MONITOR_TARGET_URL`만 지정합니다.

```bash
MONITOR_TARGET_URL=https://example.com
```

> 참고: 프로젝트에는 `MONITOR_TARGET_URL`의 **기본값(fallback)** 이 설정되어 있습니다.  
> 로컬은 `.env`가 없거나 값이 비어있으면 기본 URL로 실행되고, GitHub Actions도 Variables/Secrets가 비어있으면 기본 URL로 실행됩니다.

### 3) 모니터 실행 (리포트 생성)

```bash
npm run monitor
```

성공/실패 여부와 무관하게(설정에 따라) `public/monitor-report.json`이 갱신됩니다.

### 4) 대시보드 실행

```bash
npm run dev
```

대시보드는 `import.meta.env.BASE_URL + monitor-report.json`을 fetch 해서 결과를 보여줍니다.  
리포트가 없으면 “리포트를 찾을 수 없습니다”로 표시됩니다.

## 환경변수

`.env.example`을 기준으로, 실제로 `scripts/monitor.js`에서 사용하는 주요 값들입니다.

### 필수

- **`MONITOR_TARGET_URL`**: 모니터링할 대상 URL

### 출력

- **`MONITOR_REPORT_PATH`**: 리포트 저장 경로 (기본 `public/monitor-report.json`)
  - 값이 `none`(대소문자 무관) 또는 `0`이면 파일 저장을 생략합니다.

### 타임아웃/대기

- **`MONITOR_TIMEOUT_MS`**: Playwright 액션 기본 타임아웃 (기본 45000)
- **`MONITOR_NAV_TIMEOUT_MS`**: 네비게이션 타임아웃 (기본 30000)
- **`MONITOR_WAIT_AFTER_LOAD_MS`**: 로딩 후 추가 대기(ms) (기본 1500)

### 실패 판정 옵션

- **`MONITOR_FAIL_ON_PAGEERROR`**: `pageerror`가 있으면 실패로 기록 (기본 `true`)
- **`MONITOR_FAIL_ON_CONSOLE_ERROR`**: console `error`가 있으면 실패로 기록 (기본 `true`)
- **`MONITOR_FAIL_ON_REQUEST_FAILED`**: `requestfailed`가 있으면 실패로 기록 (기본 `false`)
- **`MONITOR_IGNORE_ERROR_PATTERNS`**: 무시할 에러 패턴(부분 문자열) 목록 (콤마 구분)

### 기타

- **`MONITOR_USER_AGENT`**: User-Agent (기본 `ad-monitoring-bot/1.0 (+https://github.com)`)

## 리포트 포맷 (`public/monitor-report.json`)

대시보드가 기대하는 타입은 `src/monitor/types.ts`의 `MonitorReport`입니다.

```json
{
  "ok": true,
  "url": "https://example.com",
  "status": 200,
  "durationMs": 1234,
  "checkedAt": "2026-02-20T12:34:56.000Z",
  "failures": [],
  "diagnostics": {
    "pageErrors": [{ "message": "…", "stack": "…" }],
    "consoleMessages": [{ "type": "error|warning", "text": "…" }],
    "requestFailures": [
      { "url": "…", "method": "GET", "resourceType": "script", "errorText": "net::ERR_FAILED" }
    ]
  }
}
```

- `ok`: 최종 성공 여부
- `failures`: 사람이 읽을 수 있는 실패 사유 목록
- `diagnostics`: 원인 파악용 상세 로그(에러/콘솔/네트워크)

## GitHub Actions (스케줄 실행 + Pages 배포)

워크플로 파일: `.github/workflows/ad-monitor.yml`

- **스케줄**: `cron: '0 * * * *'` (UTC 기준 매시간 정각)
- **Node**: 20
- **브라우저 설치**: `npx playwright install --with-deps chromium`
- **리포트 업로드**: `public/monitor-report.json`을 artifact로 업로드
- **Pages 배포(선택)**: `npm run build` 후 `dist/`를 GitHub Pages로 배포
  - 이때 `VITE_BASE`를 `/<repo-name>/`로 주입해서 경로가 맞게 동작하도록 합니다. (`vite.config.ts` 참고)

필수 Secret:

- **`MONITOR_TARGET_URL`**

## GitLab CI (참고)

`.gitlab-ci.yml`이 포함되어 있습니다(Playwright 이미지 기반).  
다만 현재 레포 기준으로는 CI 구성/Pages 경로가 조직별로 달라질 수 있으니, 필요에 맞게 조정하세요.

## 주의

- `.gitlab-ci.yml`은 예시로 포함된 상태이며, GitLab Pages 경로/변수는 조직 설정에 따라 다를 수 있습니다.

## 주요 파일

- **`scripts/monitor.js`**: Playwright로 모니터링 후 리포트 생성
- **`public/monitor-report.json`**: 최신 리포트(자동 생성/갱신, `.gitignore` 대상)
- **`src/components/MonitorReportPanel.tsx`**: 리포트 로딩/표시 UI
- **`src/monitor/types.ts`**: 리포트 타입 정의
- **`.github/workflows/ad-monitor.yml`**: 스케줄 실행 + Pages 배포
- **`vite.config.ts`**: `VITE_BASE`로 배포 base 경로 제어
