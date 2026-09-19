# RTDI Web Backend

FastAPI service that exposes the contracts already used by the Next.js dashboard.

## Local run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Create `../.env.local` for the frontend:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api
```

## Event boundary

`app/oneapi_bridge.py` contains the four calls that the deployed official
`sample.py` needs: lot start, wafer start, multi-parametric measurement, and
test end.  It intentionally does not import the OneAPI SDK, so this directory
can be developed locally.  Before deployment, confirm the exact live event
sequence and FT/CP context with the organizer.

## Current endpoint contract

- `GET /api/dashboard/snapshot`
- `GET /api/sites`, `GET /api/sites/{site}/results`
- `GET /api/lots`, `GET /api/lots/{lot}`, `GET /api/lots/{lot}/wafers/{wafer}`
- `WS /ws/live-stream`

The internal `POST /api/internal/*` routes are only a local frontend-integration
seam.  The deployed OneAPI bridge calls the shared state object directly.
