"""
HLSTranscoder: manages a single FFmpeg process per camera.
Converts RTSPS (TLS-wrapped RTSP) → HLS (.m3u8 + .ts segments).
In MOCK_MODE uses an FFmpeg synthetic test pattern instead of a real stream.
"""
import subprocess
import logging
from pathlib import Path
from config import HLS_DIR, HLS_SEGMENT_DURATION, HLS_LIST_SIZE, MOCK_MODE

logger = logging.getLogger(__name__)


class HLSTranscoder:
    def __init__(self, cam_id: str, stream_url: str):
        self.cam_id     = cam_id
        self.stream_url = stream_url
        self.output_dir = HLS_DIR / cam_id
        self._process: subprocess.Popen | None = None

    def start(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        manifest = str(self.output_dir / "stream.m3u8")
        segments = str(self.output_dir / "seg%05d.ts")

        cmd = self._build_cmd(manifest, segments)
        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        logger.info(f"FFmpeg started — cam={self.cam_id}  PID={self._process.pid}")

    def stop(self) -> None:
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            logger.info(f"FFmpeg stopped — cam={self.cam_id}")
        self._process = None

    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None

    # ── Command builders ───────────────────────────────────────────────────

    def _build_cmd(self, manifest: str, segments: str) -> list[str]:
        hls_flags = "delete_segments+append_list+independent_segments"
        hls_tail  = [
            "-f", "hls",
            "-hls_time", str(HLS_SEGMENT_DURATION),
            "-hls_list_size", str(HLS_LIST_SIZE),
            "-hls_flags", hls_flags,
            "-hls_segment_filename", segments,
            manifest,
        ]

        if MOCK_MODE or self.stream_url.startswith("mock://"):
            return self._mock_cmd() + hls_tail

        return self._rtsps_cmd() + hls_tail

    def _rtsps_cmd(self) -> list[str]:
        """Real Blink RTSPS → x264 encode."""
        return [
            "ffmpeg", "-y",
            "-rtsp_transport", "tcp",       # TLS tunnel
            "-i", self.stream_url,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-g", "30",
            "-sc_threshold", "0",
        ]

    def _mock_cmd(self) -> list[str]:
        """Synthetic 720p test pattern for dev/testing without cameras."""
        return [
            "ffmpeg", "-y",
            "-re",                          # real-time rate
            "-f", "lavfi",
            "-i", f"testsrc=size=1280x720:rate=25,drawtext="
                  f"text='{self.cam_id}':fontcolor=white:fontsize=40:"
                  f"x=10:y=10",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-g", "30",
            "-sc_threshold", "0",
        ]
