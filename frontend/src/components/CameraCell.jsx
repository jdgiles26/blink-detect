import { useState } from 'react'
import DetectionCanvas from './DetectionCanvas.jsx'

export default function CameraCell({ camera }) {
  const [detections, setDetections] = useState([])
  const hasDetections = detections.length > 0

  return (
    <div style={S.cell}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.camId}>
          <span style={{ ...S.dot, background: camera.armed ? '#00FF88' : '#4A5568',
                                   boxShadow:  camera.armed ? '0 0 6px #00FF88' : 'none' }} />
          {camera.name.toUpperCase()}
        </div>
        <div style={S.meta}>
          {hasDetections
            ? <span style={{ color: '#FFB700' }}>
                {detections.length} OBJECT{detections.length !== 1 ? 'S' : ''}
              </span>
            : <span>MONITORING</span>
          }
        </div>
      </div>

      {/* ── Video + canvas overlay ── */}
      <DetectionCanvas
        streamUrl={`/hls/${camera.id}/stream.m3u8`}
        camId={camera.id}
        onDetections={setDetections}
      />

      {/* ── Detection chips ── */}
      <div style={S.chips}>
        {hasDetections
          ? detections.map((d, i) => (
              <span
                key={i}
                style={{ ...S.chip, borderColor: d.color, color: d.color }}
              >
                {d.class}&nbsp;{Math.round(d.confidence * 100)}%
              </span>
            ))
          : <span style={S.chipIdle}>— no detections —</span>
        }
      </div>

    </div>
  )
}

const S = {
  cell: {
    background:     '#0D1220',
    border:         '1px solid #1A2035',
    display:        'flex',
    flexDirection:  'column',
    overflow:       'hidden',
    minHeight:      0,
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '5px 10px',
    background:     '#080C18',
    borderBottom:   '1px solid #1A2035',
    flexShrink:     0,
  },
  camId: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      11,
    fontWeight:    700,
    color:         '#00D4FF',
    letterSpacing: '0.12em',
    display:       'flex',
    alignItems:    'center',
    gap:           7,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: '50%',
    display:      'inline-block',
    flexShrink:   0,
  },
  meta: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    color:         '#4A5568',
    letterSpacing: '0.1em',
  },
  chips: {
    display:    'flex',
    flexWrap:   'wrap',
    gap:        4,
    padding:    '4px 8px',
    background: '#080C18',
    borderTop:  '1px solid #1A2035',
    minHeight:  28,
    flexShrink: 0,
    alignItems: 'center',
  },
  chip: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    padding:       '2px 7px',
    border:        '1px solid',
    letterSpacing: '0.06em',
  },
  chipIdle: {
    fontFamily:    "'JetBrains Mono', monospace",
    fontSize:      10,
    color:         '#2D3748',
    letterSpacing: '0.06em',
  },
}
