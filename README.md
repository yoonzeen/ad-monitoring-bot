# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Ad monitoring bot (GitHub Actions cron)

This repo includes a lightweight monitor script that can run on a schedule in GitHub Actions (every hour).

### Local run

Option A) Put env in `.env` (recommended)

- Copy `.env.example` to `.env` and edit values.

Then:

```bash
npm run monitor
```

The monitor runs in a **real browser (Playwright / Chromium)** and collects:

- JS runtime errors (`pageerror`)
- Console errors/warnings
- Network request failures (`requestfailed`)

Option B) Set env in PowerShell

PowerShell example:

```bash
$env:MONITOR_TARGET_URL = 'https://example.com'
$env:MONITOR_EXPECT_CONTAINS = 'Example Domain'
npm run monitor
```

### Show result in the web page

The monitor writes `public/monitor-report.json` by default, so the Vite dev server can serve it at `/monitor-report.json`.

```bash
npm run dev
```

Then open the page and you should see either **"이상 없음"** or a list of **"고쳐야 할 항목"**.

### GitHub Actions (hourly)

Workflow file: `.github/workflows/ad-monitor.yml`

Add these repository secrets:

- **`MONITOR_TARGET_URL`**: URL to fetch and validate
- **`MONITOR_EXPECT_CONTAINS`** (optional): comma-separated strings that must be present in the HTML
- **`MONITOR_EXPECT_NOT_CONTAINS`** (optional): comma-separated strings that must *not* be present in the HTML
- (optional) **`MONITOR_IGNORE_ERROR_PATTERNS`**: comma-separated substrings to ignore in JS/console/network errors

Notes:

- **Cron runs in UTC**: `0 * * * *` = every hour on the hour (UTC).
- Each run uploads `public/monitor-report.json` as a workflow artifact.
- The workflow also builds and deploys the site to **GitHub Pages**, so the web page shows the latest report after each run.

To enable GitHub Pages:

- Repo → **Settings → Pages**
- Source: **GitHub Actions**
