import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MonitorHistoryEntry, MonitorReport } from '../monitor/types'

type LoadState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; report: MonitorReport }

type HistoryState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; items: MonitorHistoryEntry[] }

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function MonitorReportPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  const [history, setHistory] = useState<HistoryState>({ kind: 'idle' })

  const summarizeFailures = (failures: string[] | undefined, maxItems = 2) => {
    if (!failures?.length) return null
    const shown = failures.slice(0, maxItems)
    const remaining = failures.length - shown.length
    return { shown, remaining }
  }

  const summarizeHistoryLine = (it: MonitorHistoryEntry) => {
    const consoleErrors = it.counts?.consoleErrors ?? 0
    const consoleWarnings = it.counts?.consoleWarnings ?? 0
    const pageErrors = it.counts?.pageErrors ?? 0
    const requestFailures = it.counts?.requestFailures ?? 0

    const parts: string[] = []

    if (consoleErrors || consoleWarnings) {
      parts.push(`콘솔 오류 ${consoleErrors}개, 경고 ${consoleWarnings}개`)
    } else {
      parts.push('콘솔 이상 없음')
    }

    if (pageErrors) parts.push(`페이지 오류 ${pageErrors}개`)
    if (requestFailures) parts.push(`요청 실패 ${requestFailures}개`)
    if (it.failures?.length) parts.push(`고쳐야 할 항목 ${it.failures.length}개`)

    return parts.join(' · ')
  }

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const cacheBust = Date.now()
      const reportUrl = `${import.meta.env.BASE_URL}monitor-report.json?ts=${cacheBust}`
      const res = await fetch(reportUrl, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`리포트를 불러오지 못했습니다. (HTTP ${res.status})`)
      }
      const data = (await res.json()) as unknown
      const report = data as MonitorReport
      if (
        typeof report !== 'object' ||
        report == null ||
        typeof report.ok !== 'boolean' ||
        typeof report.url !== 'string' ||
        typeof report.status !== 'number' ||
        typeof report.durationMs !== 'number' ||
        typeof report.checkedAt !== 'string' ||
        !Array.isArray(report.failures)
      ) {
        throw new Error('리포트 형식이 예상과 다릅니다.')
      }
      setState({ kind: 'loaded', report })
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistory({ kind: 'loading' })
    try {
      const cacheBust = Date.now()
      const historyUrl = `${import.meta.env.BASE_URL}history.json?ts=${cacheBust}`
      const res = await fetch(historyUrl, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`히스토리를 불러오지 못했습니다. (HTTP ${res.status})`)
      const data = (await res.json()) as unknown
      if (!Array.isArray(data)) throw new Error('히스토리 형식이 예상과 다릅니다.')
      setHistory({ kind: 'loaded', items: data as MonitorHistoryEntry[] })
    } catch (e) {
      setHistory({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    void load()
    void loadHistory()
  }, [load, loadHistory])

  const header = useMemo(() => {
    if (state.kind === 'loaded') {
      return state.report.ok ? '이상 없음' : '이상 감지'
    }
    if (state.kind === 'error') return '리포트 없음'
    return '불러오는 중…'
  }, [state])

  return (
    <section className="panel">
      <div className="panelHeader">
        <div className="panelTitle">{header}</div>
        <div className="panelActions">
          <button type="button" onClick={load} disabled={state.kind === 'loading'}>
            새로고침
          </button>
        </div>
      </div>

      {state.kind === 'loaded' ? (
        <div className="panelBody">
          <dl className="kv">
            <div>
              <dt>대상 URL</dt>
              <dd>
                <a href={state.report.url} target="_blank" rel="noreferrer">
                  {state.report.url}
                </a>
              </dd>
            </div>
            <div>
              <dt>체크 시각</dt>
              <dd>{formatDate(state.report.checkedAt)}</dd>
            </div>
            <div>
              <dt>소요 시간</dt>
              <dd>{state.report.durationMs}ms</dd>
            </div>
          </dl>

          {state.report.ok ? (
            <div className="okBox">광고 코드/페이지 상태에 문제가 발견되지 않았습니다.</div>
          ) : (
            <div className="failBox">
              <div className="failTitle">고쳐야 할 항목</div>
              <ul className="failList">
                {state.report.failures.map((f, idx) => (
                  <li key={`${idx}-${f}`}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {state.report.diagnostics ? (
            <div className="diag">
              <details className="diagItem">
                <summary>
                  추가 정보{' '}
                  <span className="count">
                    {(state.report.diagnostics.pageErrors?.length ?? 0) +
                      (state.report.diagnostics.consoleMessages?.length ?? 0) +
                      (state.report.diagnostics.requestFailures?.length ?? 0)}
                  </span>
                </summary>

                <div className="diagChips">
                  <span className="chip">
                    페이지 <b>{state.report.diagnostics.pageErrors?.length ?? 0}</b>
                  </span>
                  <span className="chip">
                    콘솔 <b>{state.report.diagnostics.consoleMessages?.length ?? 0}</b>
                  </span>
                  <span className="chip">
                    요청 <b>{state.report.diagnostics.requestFailures?.length ?? 0}</b>
                  </span>
                </div>

                <div className="diagSections">
                  <div className="diagSection">
                    <div className="diagSectionTitle">페이지</div>
                    {state.report.diagnostics.pageErrors?.length ? (
                      <ul className="diagList">
                        {state.report.diagnostics.pageErrors.map((e, idx) => (
                          <li key={`${idx}-${e.message}`}>
                            <div className="diagMain">{e.message}</div>
                            {e.stack ? <pre className="diagStack">{e.stack}</pre> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">없음</p>
                    )}
                  </div>

                  <div className="diagSection">
                    <div className="diagSectionTitle">콘솔</div>
                    {state.report.diagnostics.consoleMessages?.length ? (
                      <ul className="diagList">
                        {state.report.diagnostics.consoleMessages.map((m, idx) => (
                          <li key={`${idx}-${m.type}-${m.text}`}>
                            <span className={`pill ${m.type}`}>{m.type}</span> {m.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">없음</p>
                    )}
                  </div>

                  <div className="diagSection">
                    <div className="diagSectionTitle">요청</div>
                    {state.report.diagnostics.requestFailures?.length ? (
                      <ul className="diagList">
                        {state.report.diagnostics.requestFailures.map((r, idx) => (
                          <li key={`${idx}-${r.url}-${r.errorText}`}>
                            <div className="diagMain">
                              <span className="pill info">{r.method}</span>{' '}
                              <span className="pill info">{r.resourceType}</span> {r.errorText}
                            </div>
                            <div className="diagUrl">{r.url}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">없음</p>
                    )}
                  </div>
                </div>
              </details>
            </div>
          ) : null}

          <div className="history">
            <details className="diagItem">
              <summary>
                최근 실행 기록 <span className="count">{history.kind === 'loaded' ? history.items.length : 0}</span>
              </summary>
              <div className="btnGhostWrap">
                <button
                  type="button"
                  className="btnGhost"
                  onClick={loadHistory}
                  disabled={history.kind === 'loading'}
                >
                  <span className="btnIcon" aria-hidden="true">
                    ↻
                  </span>
                  기록 새로고침
                </button>
              </div>

              {history.kind === 'loaded' ? (
                <ul className="diagList">
                  {history.items.slice(0, 30).map((it, idx) => (
                    <li key={`${idx}-${it.checkedAt}`}>
                      <details className="historyItem">
                        <summary className="historySummaryRow">
                          <div className="historySummaryText">
                            <div className="historyWhen">{formatDate(it.checkedAt)} · {it.durationMs}ms</div>
                            <div className="historyMeta">{summarizeHistoryLine(it)}</div>
                          </div>
                          <div className="historySummaryRight" aria-hidden="true">
                            <span className="historyPill">상세</span>
                            <span className="historyChevron">▾</span>
                          </div>
                        </summary>

                        <div className="historyBody">
                          <div className="diagChips">
                            <span className="chip">
                              페이지 <b>{it.counts?.pageErrors ?? 0}</b>
                            </span>
                            <span className="chip">
                              콘솔 오류 <b>{it.counts?.consoleErrors ?? 0}</b>
                            </span>
                            <span className="chip">
                              콘솔 경고 <b>{it.counts?.consoleWarnings ?? 0}</b>
                            </span>
                            <span className="chip">
                              요청 <b>{it.counts?.requestFailures ?? 0}</b>
                            </span>
                            <span className="chip">
                              항목 <b>{it.failures?.length ?? 0}</b>
                            </span>
                          </div>

                          {(() => {
                            const s = summarizeFailures(it.failures, 10)
                            if (!s) return <p className="muted">고쳐야 할 항목 없음</p>
                            return (
                              <ul className="miniList">
                                {s.shown.map((f) => (
                                  <li key={f}>{f}</li>
                                ))}
                                {s.remaining > 0 ? <li className="miniMore">외 {s.remaining}개</li> : null}
                              </ul>
                            )
                          })()}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : history.kind === 'error' ? (
                <p className="muted">{history.message}</p>
              ) : (
                <p className="muted">불러오는 중…</p>
              )}
            </details>
          </div>
        </div>
      ) : state.kind === 'error' ? (
        <div className="panelBody">
          <div className="failBox">
            <div className="failTitle">리포트를 찾을 수 없습니다</div>
            <p className="muted">{state.message}</p>
            <p className="muted">
              먼저 <code>npm run monitor</code>를 실행해 <code>public/monitor-report.json</code>이 생성되게 한 뒤
              새로고침하세요.
            </p>
          </div>
        </div>
      ) : (
        <div className="panelBody">
          <p className="muted">잠시만 기다려주세요.</p>
        </div>
      )}
    </section>
  )
}

