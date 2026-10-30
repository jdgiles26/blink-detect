"""
Central config — every tunable lives here, backed by environment variables.
Load .env by running: pip install python-dotenv, then add load_dotenv() call.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
DATA_DIR   = Path(os.getenv("DATA_DIR", "/data"))
HLS_DIR    = DATA_DIR / "hls"
CREDS_FILE = DATA_DIR / "blink_credentials.json"
MODELS_DIR = DATA_DIR / "models"

# ── Blink ──────────────────────────────────────────────────────────────────
BLINK_EMAIL    = os.getenv("BLINK_EMAIL", "")
BLINK_PASSWORD = os.getenv("BLINK_PASSWORD", "")

# ── YOLOv8 ─────────────────────────────────────────────────────────────────
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
YOLO_CONF  = float(os.getenv("YOLO_CONF", "0.4"))

# ── Streaming ──────────────────────────────────────────────────────────────
STREAM_REFRESH_INTERVAL = int(os.getenv("STREAM_REFRESH_INTERVAL", "25"))
DETECTION_INTERVAL      = float(os.getenv("DETECTION_INTERVAL", "2.0"))
HLS_SEGMENT_DURATION    = 2    # seconds per .ts segment
HLS_LIST_SIZE           = 5    # segments kept in .m3u8 manifest

# ── Server ─────────────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# ── Dev / Mock ─────────────────────────────────────────────────────────────
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"
