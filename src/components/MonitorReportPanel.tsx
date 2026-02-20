import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MonitorReport } from '../monitor/types'

type LoadState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; report: MonitorReport }

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function MonitorReportPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' })

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

  useEffect(() => {
    void load()
  }, [load])

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
          <div className={`statusBadge ${state.report.ok ? 'ok' : 'fail'}`}>
            {state.report.ok ? 'OK' : 'FAIL'}
          </div>

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
              <dt>HTTP</dt>
              <dd>{state.report.status}</dd>
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
                  JS 에러 (pageerror) <span className="count">{state.report.diagnostics.pageErrors?.length ?? 0}</span>
                </summary>
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
              </details>

              <details className="diagItem">
                <summary>
                  콘솔 메시지 (error/warn) <span className="count">{state.report.diagnostics.consoleMessages?.length ?? 0}</span>
                </summary>
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
              </details>

              <details className="diagItem">
                <summary>
                  네트워크 실패 (requestfailed){' '}
                  <span className="count">{state.report.diagnostics.requestFailures?.length ?? 0}</span>
                </summary>
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
              </details>
            </div>
          ) : null}
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

