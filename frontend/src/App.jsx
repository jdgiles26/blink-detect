import { useState, useEffect } from 'react'
import StatusBar from './components/StatusBar.jsx'
import CameraGrid from './components/CameraGrid.jsx'

export default function App() {
  const [cameras, setCameras] = useState([])
  const [layout,  setLayout]  = useState('quad')  // single | dual | quad | hex
  const [status,  setStatus]  = useState('loading') // loading | ok | error

  useEffect(() => {
    fetch('/api/cameras')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setCameras(data)
        // Auto-select best layout for camera count
        if (data.length === 1) setLayout('single')
        else if (data.length === 2) setLayout('dual')
        else if (data.length <= 4) setLayout('quad')
        else setLayout('hex')
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div style={S.root}>
      <StatusBar
        cameras={cameras}
        layout={layout}
        setLayout={setLayout}
      />

      {status === 'loading' && (
        <div style={S.splash}>
          <span style={S.splashText}>INITIALIZING CAMERAS</span>
          <span style={S.splashSub}>connecting to backend…</span>
        </div>
      )}

      {status === 'error' && (
        <div style={S.splash}>
          <span style={{ ...S.splashText, color: '#FF4444' }}>BACKEND UNREACHABLE</span>
          <span style={S.splashSub}>
            Ensure the backend is running on :8000
          </span>
        </div>
      )}

      {status === 'ok' && cameras.length === 0 && (
        <div style={S.splash}>
          <span style={S.splashText}>NO CAMERAS FOUND</span>
          <span style={S.splashSub}>
            Check Blink credentials and run python blink_auth.py
          </span>
        </div>
      )}

      {status === 'ok' && cameras.length > 0 && (
        <CameraGrid cameras={cameras} layout={layout} />
      )}
    </div>
  )
}

const S = {
  root: {
    background: '#0A0E1A',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', sans-serif",
    color: '#E2E8F0',
    overflow: 'hidden',
  },
  splash: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 16,
    fontWeight: 700,
    color: '#00D4FF',
    letterSpacing: '0.2em',
  },
  splashSub: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#4A5568',
    letterSpacing: '0.1em',
  },
}
