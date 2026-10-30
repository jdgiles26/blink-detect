import { useState, useEffect } from 'react'

const LAYOUTS = [
  { id: 'single', label: '1' },
  { id: 'dual',   label: '2' },
  { id: 'quad',   label: '4' },
  { id: 'hex',    label: '6' },
]

export default function StatusBar({ cameras, layout, setLayout }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  }).toUpperCase()

  return (
    <div style={S.bar}>
      {/* Left — brand + stats */}
      <div style={S.left}>
        <span style={S.logo}>◈ BLINKDETECT</span>
        <span style={S.sep}>│</span>
        <span style={S.stat}>{cameras.length} CAM{cameras.length !== 1 ? 'S' : ''}</span>
        <span style={S.sep}>│</span>
        <span style={S.stat}>YOLOv8 · LIVE</span>
      </div>

      {/* Center — layout switcher */}
      <div style={S.center}>
        {LAYOUTS.map(l => (
          <button
            key={l.id}
            onClick={() => setLayout(l.id)}
            style={{ ...S.btn, ...(layout === l.id ? S.btnActive : {}) }}
            title={`${l.label}-camera layout`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Right — live clock */}
      <div style={S.right}>
        <span style={S.clock}>{hh}:{mm}:{ss}</span>
        <span style={S.date}>{dateStr}</span>
      </div>
    </div>
  )
}

const S = {
  bar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 16px',
    height:         44,
    background:     '#080C18',
    borderBottom:   '1px solid #1A2035',
    flexShrink:     0,
    userSelect:     'none',
  },
  left: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    flex:       1,
  },
  logo: {
    fontFamily:  "'JetBrains Mono', monospace",
    fontWeight:  700,
    fontSize:    13,
    color:       '#00D4FF',
    letterSpacing: '0.15em',
  },
  sep: {
    color:      '#2D3748',
    fontSize:   12,
  },
  stat: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    color:         '#4A5568',
    letterSpacing: '0.1em',
  },
  center: {
    display: 'flex',
    gap:     4,
  },
  btn: {
    background:    'transparent',
    border:        '1px solid #2D3748',
    color:         '#4A5568',
    padding:       '4px 12px',
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      11,
    letterSpacing: '0.05em',
    transition:    'all 0.15s ease',
  },
  btnActive: {
    borderColor: '#00D4FF',
    color:       '#00D4FF',
    background:  'rgba(0,212,255,0.08)',
  },
  right: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'flex-end',
    gap:            1,
  },
  clock: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      14,
    fontWeight:    700,
    color:         '#E2E8F0',
    letterSpacing: '0.06em',
  },
  date: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      9,
    color:         '#4A5568',
    letterSpacing: '0.1em',
  },
}
