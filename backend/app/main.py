from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .csv_import import CsvImportError, import_csv
from .schemas import DeviceTestResult, LotStart, Measurement, ThermalPredictRequest, WaferStart
from .state import runtime_state


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 本機 demo 預設載入 training/Data 的真實 RawResult CSV，讓 Dashboard、
    # Wafer Map 與 Fail Table 都來自同一片 wafer。正式接 OneAPI 時可用
    # ADVANTEST_MOCK_CSV=off 關閉；若找不到檔案則維持空狀態，交給前端 fallback。
    mock_enabled = os.getenv("ADVANTEST_MOCK_CSV", "on").lower() not in {"0", "false", "off", "no"}
    # 優先讀 fullstack repo 內的公開訓練資料；保留 repo 外層路徑作為舊環境
    # 相容 fallback，讓既有 VM checkout 也能繼續啟動。
    repo_data_dir = Path(__file__).resolve().parents[2] / "training" / "Data"
    legacy_data_dir = Path(__file__).resolve().parents[3] / "training" / "Data"
    default_data_dir = repo_data_dir if repo_data_dir.is_dir() else legacy_data_dir
    csv_value = os.getenv("ADVANTEST_MOCK_CSV_PATH")
    if csv_value:
        csv_paths = [Path(csv_value).expanduser()]
    else:
        csv_paths = sorted(default_data_dir.glob("A12345_W*_RawResult.csv"))

    if mock_enabled and csv_paths:
        for index, csv_path in enumerate(csv_paths):
            if not csv_path.is_file():
                continue
            match = re.search(r"_W(\d+)_RawResult$", csv_path.stem, flags=re.IGNORECASE)
            wafer = f"W{int(match.group(1)):02d}" if match else None
            try:
                import_csv(
                    str(csv_path),
                    lot_override="A12345",
                    wafer_override=wafer,
                    reset=index == 0,
                    measurement_limit=24,
                )
            except (CsvImportError, OSError):
                # CSV mock 只是本機示範資料，單一檔案載入失敗時繼續載入其他 wafer。
                continue
    yield


app = FastAPI(title="Advantest RTDI Web API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|advantestcell\.local)(:\d+)?$",
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


@app.get("/api/alerts")
def alerts() -> list[dict]:
    """Structured anomaly alerts for the dashboard and future WebSocket push."""
    return runtime_state.alerts()


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


@app.get("/api/lots/{lot}/wafers/{wafer}/fails")
def wafer_fails(lot: str, wafer: str) -> dict:
    data = runtime_state.wafer_fails(lot, wafer)
    if data is None:
        raise HTTPException(status_code=404, detail="Wafer not found")
    return data


@app.get("/api/lots/{lot}/wafers/{wafer}/distribution")
def wafer_distribution(lot: str, wafer: str, event: str | None = None) -> dict:
    data = runtime_state.wafer_distribution(lot, wafer, event)
    if data is None:
        raise HTTPException(status_code=404, detail="Wafer not found")
    return data


@app.get("/api/trends")
def trends(lot: str | None = None, wafer: str | None = None) -> list[dict]:
    return runtime_state.trends(lot=lot, wafer=wafer)


@app.get("/api/failures/explain")
def failure_explanations(limit: int = 8) -> list[dict]:
    return runtime_state.failure_explanations(max(1, min(limit, 100)))


@app.get("/api/temperature/predict")
def temperature_prediction() -> dict:
    return runtime_state.temperature_snapshot()


@app.post("/api/temperature/predict")
def predict_next_temperature(event: ThermalPredictRequest) -> dict:
    """Tester/container contract: return the next sensor prediction now."""
    data = runtime_state.predict_next_sensor(event)
    if data is None:
        raise HTTPException(status_code=422, detail="No training data or no next sensor")
    return data


@app.get("/api/thermal/wafers/{lot}/{wafer}")
def thermal_wafer(lot: str, wafer: str) -> dict:
    data = runtime_state.thermal_wafer(lot, wafer)
    if data is None:
        raise HTTPException(status_code=404, detail="No sensor data for this wafer")
    return data


@app.get("/api/thermal/validation-report")
def thermal_validation_report() -> dict:
    """Expose the generated validation artifact for the web dashboard.

    The report is generated offline by ``validate_thermal_model.py``. This
    endpoint intentionally only serves that artifact; it does not recompute
    metrics while an operator is viewing the dashboard.
    """
    report_path = Path(__file__).resolve().parents[1] / "reports" / "thermal_validation.json"
    if not report_path.is_file():
        raise HTTPException(status_code=404, detail="Thermal validation report has not been generated")
    try:
        return json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="Thermal validation report is unreadable") from error


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
    # FT 測試流程不會發出 WAFERSTART，仍需提供可查詢的資料分組給網頁。
    # 只在 OneAPI 沒有送出 wafer 時標記為 FT；CP 的真實 Wafer ID 不會改寫。
    if not event.device.wafer or event.device.wafer == "-":
        event.device.wafer = "FT"
    runtime_state.record_test_end(event)


class ThermalProgress(BaseModel):
    completed: int = Field(ge=0, le=6)


@app.post("/api/internal/thermal-progress", status_code=204)
def set_thermal_progress(event: ThermalProgress) -> None:
    """Demo control: how many sensors of the live wafer are already measured."""
    runtime_state.set_thermal_progress(event.completed)


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
