# BlinkDetect

> Self-hosted Blink camera surveillance with live YOLOv8 object detection and bounding box overlay UI.

---

## What This Does

1. Authenticates with your Blink account
2. Pulls live RTSPS streams from your wired Blink cameras
3. Transcodes streams to HLS via FFmpeg
4. Runs YOLOv8 object detection every 2 seconds per stream
5. Streams detections to a React dashboard with canvas bounding box overlay
6. Multi-camera grid layout: 1 / 2 / 4 / 6 cameras

---

## Prerequisites

- **Docker** + Docker Compose v2
- **Node.js** 18+ (for frontend dev)
- **Python** 3.11+ (for first-time auth only)
- **Blink account** with at least one wired camera
- **FFmpeg** (installed inside Docker — no local install needed)

---

## Step-by-Step Setup

### Step 1 — Copy and configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:
```
BLINK_EMAIL=your@email.com
BLINK_PASSWORD=yourpassword
```
Leave all other values as defaults for first run.

---

### Step 2 — First-time Blink authentication (run once)

Blink requires 2FA. This creates `/data/blink_credentials.json` which is reused on every subsequent start.

```bash
cd backend
pip install -r requirements.txt
python blink_auth.py
```

Follow the interactive prompts:
1. Enter email and password (or leave blank — reads from `.env`)
2. Check your email for a Blink 2FA code
3. Enter the code at the prompt

You should see: `Credentials saved to /data/blink_credentials.json`

---

### Step 3 — Start the backend

```bash
cd ..   # back to project root
docker-compose up --build
```

Backend starts at **http://localhost:8000**

Verify it's working:
```bash
curl http://localhost:8000/cameras
# Returns JSON list of your cameras
```

```bash
curl http://localhost:8000/health
# Returns { "status": "ok", "cameras": N, "streams": N }
```

---

### Step 4 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard opens at **http://localhost:5173**

---

## Dashboard Controls

| Control | Action |
|---|---|
| **1** button | Single camera fullscreen |
| **2** button | Side-by-side dual view |
| **4** button | 2×2 quad grid |
| **6** button | 2×3 hex grid |

Detection chips appear below each camera feed showing detected class and confidence.

---

## Detection Color Coding

| Color | Detected Classes |
|---|---|
| 🔴 Red `#FF4444` | person |
| 🔵 Cyan `#00D4FF` | car, truck |
| 🟡 Amber `#FFB700` | motorcycle, bicycle |
| 🟢 Green `#A0FF44` | dog, cat |
| ⚪ White `#FFFFFF` | all other classes |

---

## Testing Without Blink Cameras

```bash
# In .env
MOCK_MODE=true
```

Two synthetic cameras stream FFmpeg test patterns through the full pipeline. YOLOv8 runs on them — you won't get meaningful detections but the entire UI and stream flow works for development.

---

## Custom Detection Model

Train YOLOv8 on your own dataset (e.g., boats, vehicles, specific objects):

```bash
# Install ultralytics
pip install ultralytics

# Label your data with Roboflow or CVAT, export in YOLOv8 format
# Then train:
yolo train data=dataset.yaml model=yolov8n.pt epochs=100 imgsz=640

# Point to your model in .env:
YOLO_MODEL=/data/models/best.pt
```

Place the `.pt` file in `./data/models/` — it's mounted into the Docker container.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BLINK_EMAIL` | — | Blink account email |
| `BLINK_PASSWORD` | — | Blink account password |
| `YOLO_MODEL` | `yolov8n.pt` | Model path or name |
| `YOLO_CONF` | `0.4` | Detection confidence threshold (0–1) |
| `STREAM_REFRESH_INTERVAL` | `25` | Seconds between stream URL renewals |
| `DETECTION_INTERVAL` | `2.0` | Seconds between inference runs |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |
| `DATA_DIR` | `/data` | Volume path for HLS segments + credentials |
| `MOCK_MODE` | `false` | Skip Blink auth, use synthetic streams |

---

## Architecture

```
Blink Cloud
    │
    └─ RTSPS (TLS-wrapped RTSP, ~25s TTL)
           │
     [stream_manager.py] ── renews every 25s
           │
     [transcoder.py / FFmpeg]
           │  HLS (.m3u8 + .ts segments)
           │
     /data/hls/{cam_id}/
           │
     [detector.py / YOLOv8] ── background thread, 2s interval
           │  normalized bbox detections
           │
     [main.py / FastAPI]
           ├── GET /cameras
           ├── Static /hls/* (HLS manifest + segments)
           └── SSE /cameras/{id}/detections/stream
                     │
             [React frontend]
                     ├── HLS.js → <video>
                     └── Canvas API → bounding box overlay
```

---

## Troubleshooting

**No cameras listed**
→ Run `python blink_auth.py` — credentials file is missing or expired.

**Black / no video in browser**
→ The Blink RTSPS URL just expired. StreamManager renews every 25s — wait and refresh.

**Canvas boxes misaligned with video**
→ Resize your browser window — the canvas auto-recalculates dimensions on next detection update.

**High CPU usage**
→ Increase `DETECTION_INTERVAL=5` in `.env` or switch to `yolov8n.pt` (fastest model).

**FFmpeg not found**
→ It's installed in the Docker image. If running backend locally: `apt-get install ffmpeg`.

## Repository status (2026-10-30)

Local project folder backed up from this Mac.

- Local folder: `/private/tmp/mac-proj-extract/blink-detect`
- GitHub: https://github.com/jdgiles26/blink-detect
- Manifests: `docker-compose.yml`
- File types under the root (dependencies skipped): .py 7, .jsx 6, .js 3, (none) 2, .md 2, .example 1, .html 1, .json 1, .txt 1, .yml 1

### How to run

- `docker compose up`

### Layout

- `.env.example`
- `.gitignore`
- `backend/`
- `CLAUDE.md`
- `docker-compose.yml`
- `frontend/`
- `README.md`

Weight files (`.gguf` and similar), virtual environments, `node_modules`, and files over 95MB stay on this Mac. They are not part of this commit. Secrets such as `.env`, private keys, and recovery codes are not committed.
