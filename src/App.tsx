import './App.css'
import { MonitorReportPanel } from './components/MonitorReportPanel'
import { useState } from 'react'

function App() {
  const [mascotOk, setMascotOk] = useState(true)
  const darongUrl = `${import.meta.env.BASE_URL}darong.jpg`

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1 className="title">Ad monitoring</h1>
          <p className="subtitle">모니터링 봇 결과를 웹에서 확인합니다.</p>
        </div>

        <figure className="mascot" aria-label="대시보드 마스코트">
          {mascotOk ? (
            <img
              className="mascotImg"
              src={darongUrl}
              alt="다롱이"
              loading="lazy"
              onError={() => setMascotOk(false)}
            />
          ) : (
            <div
              className="mascotFallback"
              aria-hidden="true"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url(${darongUrl})`,
              }}
            >
              DARONG
            </div>
          )}
          <figcaption className="mascotCaption">네이트 모바일 뉴스<br/>광고 스크립트 모니터링 봇, <br/><strong>다롱이</strong></figcaption>
        </figure>
      </header>

      <main className="main">
        <MonitorReportPanel />
      </main>
    </div>
  )
}

export default App
