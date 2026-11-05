import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Spinner } from './components/common'
import { ensureCurrentAppVersion } from './utils/appVersion'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

const startApp = async () => {
  if (import.meta.env.PROD) {
    root.render(<div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)' }}><Spinner /></div>)
    const status = await ensureCurrentAppVersion({ currentVersion: __APP_BUILD_ID__ })
    if (status === 'reloading') return
    if (status === 'outdated') {
      root.render(
        <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'var(--bg)', color:'var(--text)' }}>
          <div className="crm-card" style={{ maxWidth:420, textAlign:'center' }}>
            <p style={{ marginBottom:16 }}>An update is available. Please refresh to continue.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>,
      )
      return
    }
  }
  root.render(<React.StrictMode><App /></React.StrictMode>)
}

startApp()
