# BlinkDetect — Claude Code Autonomous Dev Guide

## Project Purpose
Self-hosted Blink camera platform: pulls live RTSPS streams → transcodes to HLS via FFmpeg →
runs YOLOv8 object detection per stream → overlays bounding boxes on a React multi-camera dashboard.
No Blink mobile app required after initial auth.

## Stack
| Layer | Tech |
|---|---|
| Backend API | FastAPI (Python 3.11+) |
| Camera SDK | blinkpy 0.23+ |
| Stream transcode | FFmpeg (RTSPS → HLS) |
| Object detection | YOLOv8 via ultralytics |
| Frontend | React 18 + Vite + HLS.js |
| Infra | Docker Compose |

## File Map
```
blink-detect/
├── CLAUDE.md              ← this file
├── README.md              ← human setup guide
├── .env.example           ← env vars template
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.py          ← all env-backed config constants
│   ├── blink_auth.py      ← first-time 2FA setup (run standalone)
│   ├── blink_client.py    ← camera discovery + live URL fetching
│   ├── stream_manager.py  ← per-camera stream lifecycle + auto-renew
│   ├── transcoder.py      ← FFmpeg HLS subprocess manager
│   ├── detector.py        ← YOLOv8 background inference thread
│   └── main.py            ← FastAPI routes + SSE + static HLS serving
└── frontend/
    ├── package.json
    ├── vite.config.js      ← dev proxy: /api → :8000, /hls → :8000
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx          ← root: fetches /api/cameras, manages layout
        ├── components/
        │   ├── StatusBar.jsx    ← top bar: live clock, layout switcher
        │   ├── CameraGrid.jsx   ← CSS grid: 1/2/4/6-cam layouts
        │   ├── CameraCell.jsx   ← per-camera tile + detection chips
        │   └── DetectionCanvas.jsx ← video + canvas overlay (bboxes)
        └── hooks/
            ├── useHLSStream.js  ← HLS.js attach/detach lifecycle
            └── useDetections.js ← SSE subscriber → detection state
```

## Autonomous Setup Order
```bash
# 1. Configure
cp .env.example .env          # fill BLINK_EMAIL + BLINK_PASSWORD

# 2. First-time Blink 2FA auth (interactive, run once only)
cd backend
pip install -r requirements.txt
python blink_auth.py          # follow prompts → saves /data/blink_credentials.json

# 3. Backend
docker-compose up --build     # http://localhost:8000

# 4. Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Critical Architecture Notes

### Stream Lifecycle
- Blink RTSPS URLs expire in ~25s → `StreamManager.run()` renews every 25s
- Only ONE live view allowed per camera at a time
- FFmpeg process per camera writes: `/data/hls/{cam_id}/seg{N}.ts` + `stream.m3u8`
- `delete_segments` HLS flag keeps disk usage bounded (5 segments × 2s = 10s window)

### Detection Pipeline
- `Detector` runs a background thread (not async — CPU-bound)
- Processes second-to-last `.ts` segment (latest complete, not actively written)
- Samples 1 frame (middle) per segment to bound latency
- Returns normalized bbox coords `{x,y,w,h}` in 0–1 range → frontend scales to canvas

### API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /cameras | List cameras with metadata |
| GET | /cameras/{id}/stream | HLS manifest URL |
| GET | /cameras/{id}/detections/stream | SSE detection events |
| GET | /health | Backend status |
| Static | /hls/{cam_id}/stream.m3u8 | HLS manifest |
| Static | /hls/{cam_id}/seg*.ts | HLS segments |

### Frontend Canvas Overlay
- Canvas positioned `absolute` over `<video>`, same dimensions
- Bbox drawn as **corner brackets** (not full rectangles) — targeting reticle aesthetic
- Coordinates scaled: `px = det.bbox.x * canvas.width`
- Detection state flows: SSE → `useDetections` hook → `DetectionCanvas` → `useEffect` redraws canvas

## Extension Points
| Goal | Where to change |
|---|---|
| Custom YOLO model | `YOLO_MODEL=/data/models/best.pt` in `.env` |
| Add motion clip download | `blink_client.py → pull_clips()` |
| WebSocket instead of SSE | Replace `StreamingResponse` in `main.py` |
| Persist recordings | Remove `delete_segments` flag in `transcoder.py` |
| Add alert system | Extend `detector.py` → push to webhook on high-conf detections |
| NVIDIA GPU inference | `pip install torch --index-url https://download.pytorch.org/whl/cu121` |

## Common Issues & Fixes
| Error | Fix |
|---|---|
| `No credentials found` | Run `python blink_auth.py` first |
| `FFmpeg not found` | `apt-get install ffmpeg` (handled in Dockerfile) |
| Black/no video | Blink URL expired — StreamManager renews in ≤25s |
| Canvas bbox misaligned | Canvas resizes on video resize — handled by `clientWidth/clientHeight` read |
| SSE not connecting | Check CORS_ORIGINS in `.env` matches frontend URL |
| High CPU | Increase `DETECTION_INTERVAL` in `.env` (default 2.0s) |

## Test Without Blink Hardware (Mock Mode)
```bash
# In .env
MOCK_MODE=true
```
When `MOCK_MODE=true`, `blink_client.py` returns 2 synthetic cameras and
`transcoder.py` substitutes a local FFmpeg test pattern instead of an RTSPS URL:
```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=25 -f hls ...
```
This lets you develop and test the full frontend + detection pipeline with no hardware.
