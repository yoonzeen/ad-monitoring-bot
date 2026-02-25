export type MonitorReport = {
  ok: boolean
  url: string
  status: number
  durationMs: number
  checkedAt: string
  failures: string[]
  diagnostics?: {
    pageErrors?: { message: string; stack?: string }[]
    consoleMessages?: { type: string; text: string }[]
    requestFailures?: { url: string; method: string; resourceType: string; errorText: string }[]
  }
}

export type MonitorHistoryEntry = {
  checkedAt: string
  ok: boolean
  url: string
  status: number
  durationMs: number
  failures: string[]
  counts: {
    pageErrors: number
    consoleErrors: number
    consoleWarnings: number
    requestFailures: number
  }
  meta?: {
    runId?: string
    runUrl?: string
    sha?: string
  }
}

