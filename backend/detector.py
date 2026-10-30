"""
Detector: background thread that runs YOLOv8 inference on the latest
HLS segment for every active camera directory.

Detection format returned to API:
{
  "class":      "person",
  "confidence": 0.87,
  "bbox": { "x": 0.1, "y": 0.2, "w": 0.15, "h": 0.4 },   ← normalized 0–1
  "color":      "#FF4444"
}

Normalized bboxes are resolution-independent — the frontend scales to canvas px.
"""
import cv2
import time
import logging
import threading
from pathlib import Path
from ultralytics import YOLO
from config import HLS_DIR, YOLO_MODEL, YOLO_CONF, DETECTION_INTERVAL

logger = logging.getLogger(__name__)

# ── Per-class overlay colors ───────────────────────────────────────────────
CLASS_COLORS: dict[str, str] = {
    "person":     "#FF4444",
    "car":        "#00D4FF",
    "truck":      "#00D4FF",
    "bus":        "#00D4FF",
    "motorcycle": "#FFB700",
    "bicycle":    "#FFB700",
    "dog":        "#A0FF44",
    "cat":        "#A0FF44",
    "bird":       "#A0FF44",
    "boat":       "#FF8800",
    "airplane":   "#FF8800",
}
DEFAULT_COLOR = "#FFFFFF"


class Detector:
    def __init__(self):
        logger.info(f"Loading YOLO model: {YOLO_MODEL}")
        self.model = YOLO(YOLO_MODEL)

        self._results: dict[str, list[dict]] = {}  # cam_id → detections
        self._lock    = threading.Lock()
        self._running = True

        self._thread = threading.Thread(target=self._loop, daemon=True, name="detector")
        self._thread.start()
        logger.info("Detector background thread started")

    # ── Public ─────────────────────────────────────────────────────────────

    def get_latest(self, cam_id: str) -> list[dict]:
        with self._lock:
            return list(self._results.get(cam_id, []))

    def stop(self) -> None:
        self._running = False

    # ── Background thread ──────────────────────────────────────────────────

    def _loop(self) -> None:
        while self._running:
            if HLS_DIR.exists():
                for cam_dir in [d for d in HLS_DIR.iterdir() if d.is_dir()]:
                    self._process_camera(cam_dir.name, cam_dir)
            time.sleep(DETECTION_INTERVAL)

    def _process_camera(self, cam_id: str, cam_dir: Path) -> None:
        segments = sorted(cam_dir.glob("seg*.ts"))
        # Need at least 2 segments — avoid reading the actively-written one
        if len(segments) < 2:
            return

        target = segments[-2]  # latest *complete* segment

        cap = cv2.VideoCapture(str(target))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total == 0:
            cap.release()
            return

        # Sample the middle frame — minimises latency vs full-segment processing
        cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return

        h, w = frame.shape[:2]
        results = self.model(frame, conf=YOLO_CONF, verbose=False)

        detections: list[dict] = []
        for r in results:
            for box in r.boxes:
                cls_name = self.model.names[int(box.cls)]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class":      cls_name,
                    "confidence": round(float(box.conf), 3),
                    # Normalize to 0–1 for resolution-independent frontend scaling
                    "bbox": {
                        "x": round(x1 / w, 4),
                        "y": round(y1 / h, 4),
                        "w": round((x2 - x1) / w, 4),
                        "h": round((y2 - y1) / h, 4),
                    },
                    "color": CLASS_COLORS.get(cls_name, DEFAULT_COLOR),
                })

        with self._lock:
            self._results[cam_id] = detections

        if detections:
            classes = [d["class"] for d in detections]
            logger.debug(f"{cam_id}: {classes}")
