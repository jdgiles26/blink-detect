"""
BlinkClient: wraps blinkpy to discover cameras and fetch ephemeral live stream URLs.
In MOCK_MODE returns two synthetic cameras with no network calls.
"""
import logging
import aiohttp
from blinkpy.blinkpy import Blink
from blink_auth import load_auth
from config import MOCK_MODE

logger = logging.getLogger(__name__)

# ── Mock cameras for dev/testing without hardware ──────────────────────────
MOCK_CAMERAS = [
    {"id": "cam_mock_1", "name": "Front Door",  "network": 0, "armed": True,  "thumbnail": ""},
    {"id": "cam_mock_2", "name": "Back Yard",   "network": 0, "armed": True,  "thumbnail": ""},
]


class BlinkClient:
    def __init__(self):
        self.blink: Blink | None = None
        self.session: aiohttp.ClientSession | None = None
        self._cameras: dict = {}

    async def start(self) -> None:
        if MOCK_MODE:
            logger.info("MOCK_MODE — skipping Blink auth, using synthetic cameras")
            return

        self.session = aiohttp.ClientSession()
        self.blink   = Blink(session=self.session)

        try:
            auth = await load_auth()
            self.blink.auth = auth
            await self.blink.start()
            self._cameras = self.blink.cameras
            logger.info(f"✓ Blink connected — {len(self._cameras)} camera(s)")
        except FileNotFoundError as exc:
            logger.error(str(exc))
            raise

    # ── Public API ─────────────────────────────────────────────────────────

    def get_camera_list(self) -> list[dict]:
        if MOCK_MODE:
            return MOCK_CAMERAS

        return [
            {
                "id":        _cam_id(name),
                "name":      name,
                "network":   cam.network_id,
                "armed":     cam.arm,
                "thumbnail": cam.thumbnail or "",
            }
            for name, cam in self._cameras.items()
        ]

    async def get_live_url(self, cam_id: str) -> str | None:
        """Return an ephemeral RTSPS URL for the given camera ID."""
        if MOCK_MODE:
            # Return a null-source ffmpeg URL; transcoder handles MOCK_MODE
            return f"mock://{cam_id}"

        # Reverse map cam_id → camera name
        cam_name = _name_from_id(cam_id, self._cameras)
        if not cam_name:
            logger.warning(f"Camera ID '{cam_id}' not found in camera list")
            return None

        cam = self._cameras[cam_name]
        try:
            await cam.get_liveview()
            url = getattr(cam, "live_stream", None) or cam.attributes.get("video_url")
            if url:
                logger.debug(f"Live URL fetched for {cam_name}")
            return url
        except Exception as exc:
            logger.error(f"Failed to get live URL for {cam_name}: {exc}")
            return None

    async def close(self) -> None:
        if self.session:
            await self.session.close()


# ── Helpers ────────────────────────────────────────────────────────────────

def _cam_id(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_")

def _name_from_id(cam_id: str, cameras: dict) -> str | None:
    for name in cameras:
        if _cam_id(name) == cam_id:
            return name
    return None
