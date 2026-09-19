from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .csv_import import CsvImportError, import_csv
from .schemas import DeviceTestResult, LotStart, Measurement, WaferStart
from .state import runtime_state


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Advantest RTDI Web API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard/snapshot")
def dashboard_snapshot() -> dict:
    return runtime_state.snapshot()


@app.get("/api/sites")
def sites() -> list[dict]:
    return runtime_state.site_summaries()


@app.get("/api/sites/{site}/results")
def site_results(site: int) -> list[dict]:
    return runtime_state.site_results(site)


@app.get("/api/lots")
def lots() -> list[dict]:
    return runtime_state.lots()


@app.get("/api/lots/{lot}")
def lot_summary(lot: str) -> dict:
    data = runtime_state.lot_summary(lot)
    if data is None:
        raise HTTPException(status_code=404, detail="Lot not found")
    return data


@app.get("/api/lots/{lot}/wafers/{wafer}")
def wafer_map(lot: str, wafer: str) -> dict:
    data = runtime_state.wafer_map(lot, wafer)
    if data is None:
        raise HTTPException(status_code=404, detail="Wafer not found")
    return data


@app.get("/api/trends")
def trends() -> list[dict]:
    return runtime_state.trends()


@app.get("/api/failures/explain")
def failure_explanations(limit: int = 8) -> list[dict]:
    return runtime_state.failure_explanations(max(1, min(limit, 100)))


@app.get("/api/temperature/predict")
def temperature_prediction() -> dict:
    return runtime_state.temperature_snapshot()


@app.websocket("/ws/live-stream")
async def live_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"type": "dashboard", "data": runtime_state.snapshot()})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


# The following endpoints are deliberately small adapter seams.  The OneAPI
# callback bridge invokes the same state methods in production; these endpoints
# let the frontend team test its integration locally without ACS hardware.
@app.post("/api/internal/lot-start", status_code=204)
def ingest_lot_start(event: LotStart) -> None:
    runtime_state.start_lot(event.lot)


@app.post("/api/internal/wafer-start", status_code=204)
def ingest_wafer_start(event: WaferStart) -> None:
    runtime_state.start_wafer(event.wafer, event.radius)


@app.post("/api/internal/measurement", status_code=204)
def ingest_measurement(event: Measurement) -> None:
    runtime_state.record_measurement(event)


@app.post("/api/internal/test-end", status_code=204)
def ingest_test_end(event: DeviceTestResult) -> None:
    runtime_state.record_test_end(event)


@app.post("/api/internal/import-csv")
def import_local_csv(
    path: str,
    reset: bool = True,
    lot: str | None = None,
    wafer: str | None = None,
    measurement_limit: int = 24,
) -> dict:
    """Load a local test-log CSV into the runtime dashboard state.

    This endpoint is intentionally for local development and demos. Production
    ACS data should enter through the OneAPI callback adapters above instead.
    """
    try:
        return import_csv(
            path,
            lot_override=lot,
            wafer_override=wafer,
            reset=reset,
            measurement_limit=max(1, min(measurement_limit, 100)),
        )
    except CsvImportError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
