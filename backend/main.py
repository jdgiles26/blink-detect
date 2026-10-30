"""
BlinkDetect FastAPI backend.

Endpoints:
  GET  /cameras                                 → camera list
  GET  /cameras/{cam_id}/stream                 → HLS manifest URL
  GET  /cameras/{cam_id}/detections             → latest detections (REST)
  GET  /cameras/{cam_id}/detections/stream      → SSE detection stream
  GET  /health                                  → status
  Static /hls/{cam_id}/stream.m3u8              → HLS manifest
  Static /hls/{cam_id}/seg*.ts                  → HLS segments
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from config import HLS_DIR, CORS_ORIGINS, DETECTION_INTERVAL
from blink_client import BlinkClient
from stream_manager import StreamManager
from detector import Detector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Singletons ─────────────────────────────────────────────────────────────
blink_client:   BlinkClient   | None = None
stream_manager: StreamManager | None = None
detector:       Detector      | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global blink_client, stream_manager, detector

    # Ensure HLS output directory exists
    HLS_DIR.mkdir(parents=True, exist_ok=True)

    # Boot sequence
    blink_client = BlinkClient()
    await blink_client.start()

    detector = Detector()

    stream_manager = StreamManager(blink_client)
    asyncio.create_task(stream_manager.run())

    logger.info("BlinkDetect backend ready")
    yield

    # Shutdown
    if stream_manager:
        stream_manager.stop_all()
    if detector:
        detector.stop()
    if blink_client:
        await blink_client.close()


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="BlinkDetect API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve HLS segments as static files
app.mount("/hls", StaticFiles(directory=str(HLS_DIR), html=False), name="hls")


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/cameras")
def list_cameras():
    if not blink_client:
        raise HTTPException(503, "Blink client not initialized")
    return blink_client.get_camera_list()


@app.get("/cameras/{cam_id}/stream")
def get_stream_url(cam_id: str):
    return {
        "cam_id":  cam_id,
        "hls_url": f"/hls/{cam_id}/stream.m3u8",
    }


@app.get("/cameras/{cam_id}/detections")
def get_detections(cam_id: str):
    """Single-shot REST poll — use the SSE endpoint for live updates."""
    if not detector:
        return []
    return detector.get_latest(cam_id)


@app.get("/cameras/{cam_id}/detections/stream")
async def detection_sse(cam_id: str):
    """
    Server-Sent Events stream of detection results.
    Frontend useDetections hook subscribes here.
    Emits a JSON array every DETECTION_INTERVAL seconds.
    """
    async def event_gen():
        while True:
            detections = detector.get_latest(cam_id) if detector else []
            yield f"data: {json.dumps(detections)}\n\n"
            await asyncio.sleep(DETECTION_INTERVAL)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",       # disable Nginx buffering
            "Connection":        "keep-alive",
        },
    )


@app.get("/health")
def health():
    return {
        "status":        "ok",
        "cameras":       len(blink_client.get_camera_list()) if blink_client else 0,
        "active_streams": stream_manager.active_count() if stream_manager else 0,
    }
