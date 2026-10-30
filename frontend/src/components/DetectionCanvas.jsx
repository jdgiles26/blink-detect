import { useRef, useEffect } from 'react'
import useHLSStream from '../hooks/useHLSStream.js'
import useDetections from '../hooks/useDetections.js'

/**
 * DetectionCanvas
 * Renders a live HLS video stream with a canvas overlay
 * that draws targeting-reticle bounding boxes for each detection.
 *
 * Bbox coordinate system:
 *   Backend returns normalized {x, y, w, h} in 0–1 range.
 *   Canvas scales them to pixel coords using clientWidth/clientHeight.
 */
export default function DetectionCanvas({ streamUrl, camId, onDetections }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)

  useHLSStream(videoRef, streamUrl)
  const detections = useDetections(camId)

  // Propagate detections up to CameraCell for the chip list
  useEffect(() => {
    onDetections(detections)
  }, [detections])

  // Redraw canvas whenever detections update
  useEffect(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    // Match canvas pixel dimensions to video display size
    canvas.width  = video.clientWidth
    canvas.height = video.clientHeight

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const det of detections) {
      drawDetection(ctx, det, canvas.width, canvas.height)
    }
  }, [detections])

  return (
    <div style={S.wrapper}>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={S.video}
      />

      {/* Bounding box overlay canvas */}
      <canvas ref={canvasRef} style={S.canvas} />

      {/* Subtle scanline texture — surveillance aesthetic */}
      <div style={S.scanlines} aria-hidden />

      {/* Corner frame brackets — non-interactive decoration */}
      <Corner pos={{ top: 8, left: 8 }}  borders="top-left"  />
      <Corner pos={{ top: 8, right: 8 }} borders="top-right" />
      <Corner pos={{ bottom: 8, left: 8 }}  borders="bottom-left"  />
      <Corner pos={{ bottom: 8, right: 8 }} borders="bottom-right" />

    </div>
  )
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function drawDetection(ctx, det, cw, ch) {
  const { x, y, w, h } = det.bbox
  const px     = x * cw
  const py     = y * ch
  const pw     = w * cw
  const ph     = h * ch
  const color  = det.color || '#00D4FF'
  const corner = Math.min(pw, ph) * 0.22   // bracket arm length

  ctx.save()

  // Glow
  ctx.shadowColor = color
  ctx.shadowBlur  = 10
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.8

  // Corner bracket reticle (no full rectangle — targeting aesthetic)
  drawBrackets(ctx, px, py, pw, ph, corner)

  // Centre crosshair dot
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(px + pw / 2, py + ph / 2, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0

  // Label background
  const label   = `${det.class.toUpperCase()}  ${Math.round(det.confidence * 100)}%`
  const padding = 4
  const fSize   = Math.max(9, Math.min(12, pw * 0.12))
  ctx.font      = `700 ${fSize}px 'JetBrains Mono', monospace`

  const textW = ctx.measureText(label).width
  const chipH = fSize + padding * 2
  const chipY = py - chipH - 2
  const chipX = px

  // Chip
  ctx.fillStyle = `${color}20`
  ctx.fillRect(chipX, Math.max(0, chipY), textW + padding * 2, chipH)

  // Border line at bottom of chip
  ctx.strokeStyle = color
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(chipX, Math.max(0, chipY) + chipH)
  ctx.lineTo(chipX + textW + padding * 2, Math.max(0, chipY) + chipH)
  ctx.stroke()

  // Text
  ctx.fillStyle = color
  ctx.fillText(label, chipX + padding, Math.max(chipH - padding, chipY + chipH - padding))

  ctx.restore()
}

function drawBrackets(ctx, x, y, w, h, len) {
  ctx.beginPath()
  // Top-left
  ctx.moveTo(x, y + len)
  ctx.lineTo(x, y)
  ctx.lineTo(x + len, y)
  // Top-right
  ctx.moveTo(x + w - len, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + len)
  // Bottom-left
  ctx.moveTo(x, y + h - len)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + len, y + h)
  // Bottom-right
  ctx.moveTo(x + w - len, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y + h - len)
  ctx.stroke()
}

// ── Corner frame decoration ──────────────────────────────────────────────────

function Corner({ pos, borders }) {
  const borderMap = {
    'top-left':     { borderTop: '2px solid rgba(0,212,255,0.25)', borderLeft:  '2px solid rgba(0,212,255,0.25)' },
    'top-right':    { borderTop: '2px solid rgba(0,212,255,0.25)', borderRight: '2px solid rgba(0,212,255,0.25)' },
    'bottom-left':  { borderBottom: '2px solid rgba(0,212,255,0.25)', borderLeft:  '2px solid rgba(0,212,255,0.25)' },
    'bottom-right': { borderBottom: '2px solid rgba(0,212,255,0.25)', borderRight: '2px solid rgba(0,212,255,0.25)' },
  }
  return (
    <div
      aria-hidden
      style={{ ...S.corner, ...pos, ...borderMap[borders] }}
    />
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  wrapper: {
    flex:       1,
    position:   'relative',
    background: '#000',
    overflow:   'hidden',
    minHeight:  0,
  },
  video: {
    width:      '100%',
    height:     '100%',
    objectFit:  'cover',
    display:    'block',
  },
  canvas: {
    position:       'absolute',
    top:            0,
    left:           0,
    width:          '100%',
    height:         '100%',
    pointerEvents:  'none',
    zIndex:         1,
  },
  scanlines: {
    position:   'absolute',
    inset:      0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
    pointerEvents: 'none',
    zIndex:     2,
  },
  corner: {
    position:      'absolute',
    width:         18,
    height:        18,
    pointerEvents: 'none',
    zIndex:        3,
  },
}
