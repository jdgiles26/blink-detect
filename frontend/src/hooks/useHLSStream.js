import { useEffect } from 'react'
import Hls from 'hls.js'

/**
 * Attaches an HLS.js player to a <video> ref.
 * Handles native HLS (Safari) as fallback.
 * Auto-retries on fatal stream errors (e.g. Blink URL refresh).
 */
export default function useHLSStream(videoRef, streamUrl) {
  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    let hls
    let retryTimer

    function attach() {
      if (Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode:           true,
          liveDurationInfinity:     true,
          liveMaxLatencyDurationCount: 4,
          liveSyncDurationCount:    2,
          // Retry stale manifests aggressively — Blink refreshes every 25s
          manifestLoadingMaxRetry:  6,
          manifestLoadingRetryDelay: 1000,
        })

        hls.loadSource(streamUrl)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => { /* autoplay blocked — user gesture needed */ })
        })

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            // Fatal error — destroy and retry in 3s (stream may be renewing)
            hls.destroy()
            retryTimer = setTimeout(attach, 3000)
          }
        })

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari / iOS)
        video.src = streamUrl
        video.play().catch(() => {})
      }
    }

    attach()

    return () => {
      clearTimeout(retryTimer)
      if (hls) hls.destroy()
      video.src = ''
    }
  }, [streamUrl])
}
