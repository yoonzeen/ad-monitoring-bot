import './App.css'
import { MonitorReportPanel } from './components/MonitorReportPanel'

function App() {
  return (
    <div className="app">
      <header className="top">
        <div>
          <h1 className="title">Ad monitoring</h1>
          <p className="subtitle">모니터링 봇 결과를 웹에서 확인합니다.</p>
        </div>
      </header>

      <main className="main">
        <MonitorReportPanel />
      </main>
    </div>
  )
}

export default App
