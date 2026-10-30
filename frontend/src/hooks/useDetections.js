import { useState, useEffect, useRef } from 'react'

/**
 * Subscribes to the SSE detection stream for a given camera.
 * Falls back to polling REST if SSE fails.
 * Returns the latest detections array.
 */
export default function useDetections(camId) {
  const [detections, setDetections] = useState([])
  const esRef    = useRef(null)
  const pollRef  = useRef(null)

  useEffect(() => {
    if (!camId) return

    // ── SSE (primary) ────────────────────────────────────────────────────
    function openSSE() {
      const es = new EventSource(`/api/cameras/${camId}/detections/stream`)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          setDetections(JSON.parse(e.data))
        } catch {
          // Malformed frame — ignore
        }
      }

      es.onerror = () => {
        // SSE closed — fall back to REST polling
        es.close()
        startPolling()
      }
    }

    // ── REST polling fallback ────────────────────────────────────────────
    function startPolling() {
      if (pollRef.current) return
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/cameras/${camId}/detections`)
          if (res.ok) setDetections(await res.json())
        } catch {
          // Network error — silently retry next interval
        }
      }, 2500)
    }

    openSSE()

    return () => {
      esRef.current?.close()
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [camId])

  return detections
}
