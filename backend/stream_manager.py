"""
StreamManager: coordinates stream lifecycle for all cameras.
Renews Blink RTSPS URLs every STREAM_REFRESH_INTERVAL seconds
(Blink URLs expire after ~30s) and restarts FFmpeg accordingly.
"""
import asyncio
import logging
from blink_client import BlinkClient
from transcoder import HLSTranscoder
from config import STREAM_REFRESH_INTERVAL

logger = logging.getLogger(__name__)


class StreamManager:
    def __init__(self, blink_client: BlinkClient):
        self.client = blink_client
        self.transcoders: dict[str, HLSTranscoder] = {}
        self._running = False

    async def run(self) -> None:
        """Main async loop — call as a background task."""
        self._running = True
        cameras = self.client.get_camera_list()

        if not cameras:
            logger.warning("No cameras found — StreamManager idle")
            return

        logger.info(f"StreamManager: managing {len(cameras)} camera stream(s)")

        while self._running:
            for cam in cameras:
                await self._refresh(cam["id"])
            await asyncio.sleep(STREAM_REFRESH_INTERVAL)

    async def _refresh(self, cam_id: str) -> None:
        """Fetch a fresh RTSPS URL and restart the FFmpeg transcoder."""
        url = await self.client.get_live_url(cam_id)
        if not url:
            logger.warning(f"No stream URL for {cam_id} — skipping refresh")
            return

        # Gracefully stop existing transcoder
        if cam_id in self.transcoders:
            self.transcoders[cam_id].stop()

        t = HLSTranscoder(cam_id, url)
        t.start()
        self.transcoders[cam_id] = t
        logger.info(f"Stream refreshed → /hls/{cam_id}/stream.m3u8")

    def stop_all(self) -> None:
        self._running = False
        for t in self.transcoders.values():
            t.stop()
        self.transcoders.clear()
        logger.info("All streams stopped")

    def active_count(self) -> int:
        return sum(1 for t in self.transcoders.values() if t.is_running())
