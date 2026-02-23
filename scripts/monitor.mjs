import process from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

await mkdir('public', { recursive: true }); // 실행 전 폴더를 먼저 만들어야 함

function getEnv(name, { required = false, defaultValue = undefined } = {}) {
  const value = process.env[name]
  if (value == null || value === '') {
    if (required) throw new Error(`Missing required env: ${name}`)
    return defaultValue
  }
  return value
}

function parseList(value) {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseBool(value, defaultValue) {
  if (value == null || value === '') return defaultValue
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return defaultValue
}

function safeSnippet(s, maxLen = 120) {
  const oneLine = String(s).replaceAll(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen - 1)}…`
}

function stripOptionalQuotes(v) {
  const s = v.trim()
  if (s.length >= 2) {
    const q = s[0]
    if ((q === '"' || q === "'") && s[s.length - 1] === q) return s.slice(1, -1)
  }
  return s
}

async function loadDotEnv(path = '.env') {
  try {
    const raw = await readFile(path, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      const value = stripOptionalQuotes(m[2])
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value
      }
    }
  } catch {
    // ignore missing/invalid .env
  }
}

async function ensureParentDir(filePath) {
  const dir = path.dirname(filePath)
  if (dir && dir !== '.') await mkdir(dir, { recursive: true })
}

async function main() {
  await loadDotEnv()

  const targetUrl = getEnv('MONITOR_TARGET_URL', { required: true })
  const timeoutMs = Number(getEnv('MONITOR_TIMEOUT_MS', { defaultValue: '45000' }))
  const navTimeoutMs = Number(getEnv('MONITOR_NAV_TIMEOUT_MS', { defaultValue: '30000' }))
  const afterLoadWaitMs = Number(getEnv('MONITOR_WAIT_AFTER_LOAD_MS', { defaultValue: '1500' }))
  const userAgent = getEnv('MONITOR_USER_AGENT', {
    defaultValue: 'ad-monitoring-bot/1.0 (+https://github.com)',
  })

  const reportPath = getEnv('MONITOR_REPORT_PATH', { defaultValue: 'public/monitor-report.json' })

  const failOnPageError = parseBool(getEnv('MONITOR_FAIL_ON_PAGEERROR', { defaultValue: 'true' }), true)
  const failOnConsoleError = parseBool(getEnv('MONITOR_FAIL_ON_CONSOLE_ERROR', { defaultValue: 'true' }), true)
  const failOnRequestFailed = parseBool(getEnv('MONITOR_FAIL_ON_REQUEST_FAILED', { defaultValue: 'false' }), false)
  const ignoreErrorPatterns = parseList(getEnv('MONITOR_IGNORE_ERROR_PATTERNS', { defaultValue: '' }))

  const startedAt = Date.now()

  let status = 0
  let ok = false
  /** @type {string[]} */
  const failures = []
  /** @type {{ message: string, stack?: string }[]} */
  const pageErrors = []
  /** @type {{ type: string, text: string }[]} */
  const consoleMessages = []
  /** @type {{ url: string, method: string, resourceType: string, errorText: string }[]} */
  const requestFailures = []

  const shouldIgnore = (text) => ignoreErrorPatterns.some((p) => p && text.includes(p))

  try {
    /** @type {import('playwright').Browser | undefined} */
    let browser
    /** @type {import('playwright').BrowserContext | undefined} */
    let context
    try {
      browser = await chromium.launch({ headless: true })
      context = await browser.newContext({
        userAgent,
        viewport: { width: 1280, height: 720 },
      })
      const page = await context.newPage()
      page.setDefaultTimeout(Number.isFinite(timeoutMs) ? timeoutMs : 45000)
      page.setDefaultNavigationTimeout(Number.isFinite(navTimeoutMs) ? navTimeoutMs : 30000)

      page.on('pageerror', (err) => {
        const message = err instanceof Error ? err.message : String(err)
        if (shouldIgnore(message)) return
        pageErrors.push({ message, stack: err instanceof Error ? err.stack : undefined })
      })
      page.on('console', (msg) => {
        const type = msg.type()
        const text = msg.text()
        if (type === 'error' || type === 'warning') {
          if (shouldIgnore(text)) return
          consoleMessages.push({ type, text })
        }
      })
      page.on('requestfailed', (req) => {
        const failure = req.failure()
        const errorText = failure?.errorText ?? 'request failed'
        const url = req.url()
        if (shouldIgnore(`${url} ${errorText}`)) return
        requestFailures.push({
          url,
          method: req.method(),
          resourceType: req.resourceType(),
          errorText,
        })
      })

      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      status = response?.status() ?? 0
      if (status && (status < 200 || status >= 300)) {
        failures.push(`HTTP status not OK: ${status}`)
      }

      try {
        await page.waitForLoadState('networkidle')
      } catch {
        // It's common for pages to keep long-polling; don't fail on this alone.
      }
      if (Number.isFinite(afterLoadWaitMs) && afterLoadWaitMs > 0) {
        await page.waitForTimeout(afterLoadWaitMs)
      }

      const html = await page.content()
      for (const needle of expectContains) {
        if (!html.includes(needle)) failures.push(`Missing expected text: ${safeSnippet(needle)}`)
      }
      for (const needle of expectNotContains) {
        if (html.includes(needle)) failures.push(`Found disallowed text: ${safeSnippet(needle)}`)
      }

      if (failOnPageError && pageErrors.length > 0) failures.push(`JS page errors: ${pageErrors.length}`)
      if (failOnConsoleError && consoleMessages.some((m) => m.type === 'error')) {
        failures.push(`Console errors: ${consoleMessages.filter((m) => m.type === 'error').length}`)
      }
      if (failOnRequestFailed && requestFailures.length > 0) failures.push(`Request failures: ${requestFailures.length}`)

      ok = failures.length === 0
    } finally {
      await context?.close().catch(() => {})
      await browser?.close().catch(() => {})
    }
  } catch (err) {
    failures.push(`Request failed: ${err instanceof Error ? err.message : String(err)}`)
    ok = false
  }

  const durationMs = Date.now() - startedAt
  const result = {
    ok,
    url: targetUrl,
    status,
    durationMs,
    checkedAt: new Date().toISOString(),
    failures,
    diagnostics: {
      pageErrors,
      consoleMessages,
      requestFailures,
    },
  }

  if (reportPath && reportPath !== '0' && reportPath.toLowerCase() !== 'none') {
    await ensureParentDir(reportPath)
    await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8')
    console.log(`Wrote report: ${reportPath}`)
  }

  if (ok) {
    console.log(`OK: ${targetUrl} (${status}) in ${durationMs}ms`)
    process.exitCode = 0
    return
  }

  console.error(`FAIL: ${targetUrl} (${status || 'no status'}) in ${durationMs}ms`)
  for (const f of failures) console.error(`- ${f}`)
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err))
  process.exitCode = 2
})
