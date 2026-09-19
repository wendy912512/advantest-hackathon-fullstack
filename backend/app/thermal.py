"""Per-device sensor (thermal) prediction for one wafer.

Flow this implements (see docs / Notion "場景二"):

  已完成的測試資料 -> 在「下一個 sensor 測試執行前」對整片 wafer 的每個 device
  分別預測 -> 預測超過門檻立即產生通知 -> sensor 實測完成後回填實際值、算誤差、
  判定「預測成功 / 誤報 / 漏報」。

The model here is a BASELINE STAND-IN, not the production model:

* Features for sensor K are only the values recorded BEFORE sensor K in the
  device's column order (earlier IDDQ/parametric columns + earlier sensors), so
  it never sees sensor K itself or anything after it (no data leakage).
* Ridge regression trained leave-one-device-out on the same wafer. In a real
  run the model must be trained on the 25 training wafers instead; the same
  wafer's own sensor-K values are of course NOT available before sensor K runs.
  Only wafer W01 is in the repo, so this stand-in keeps the demo honest about
  prediction quality (real RMSE) without pretending to be the final model.
  The data-analysis teammate's model should replace ``predict_sensor()``.
"""
from __future__ import annotations

import json
import pickle
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from .schemas import DeviceTestResult, TestResultField

SENSOR_NAME_RE = re.compile(r"\.sensor(\d+)$")

# Warning band below the upper limit (same unit as the sensor). Placeholder —
# needs confirming with the test engineer, see Notion 對齊表.
WARN_MARGIN = 0.1
MIN_TRAIN_DEVICES = 8
RIDGE_LAMBDA = 10.0
DEFAULT_UNIT = "°C"  # CSV has no unit column; assumed from the task wording.
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


def sensor_index(field: TestResultField) -> int | None:
    match = SENSOR_NAME_RE.search(field.testSuiteName)
    return int(match.group(1)) if match else None


def sensor_label(field: TestResultField) -> str:
    pin = f"#{field.pinName}" if field.pinName else ""
    return f"{field.testNumber}_{field.testSuiteName}{pin}"


def classify(predicted: float | None, upper: float | None) -> str:
    if predicted is None or upper is None:
        return "pending"
    if predicted >= upper:
        return "critical"
    if predicted >= upper - WARN_MARGIN:
        return "warning"
    return "normal"


def verdict_for(predicted_status: str, actual: float | None, upper: float | None) -> str | None:
    """Compare the prediction with the measured value once it exists."""
    if actual is None or upper is None or predicted_status == "pending":
        return None
    actual_status = classify(actual, upper)
    predicted_alarm = predicted_status != "normal"
    actual_alarm = actual_status != "normal"
    if predicted_alarm and actual_alarm:
        return "hit"  # 預測成功
    if predicted_alarm and not actual_alarm:
        return "false_alarm"  # 誤報
    if not predicted_alarm and actual_alarm:
        return "miss"  # 漏報
    return "ok"  # 預測正常，實測也正常


def predict_sensor(features: np.ndarray, target: np.ndarray) -> np.ndarray:
    """Leave-one-device-out ridge prediction. ``target`` may contain NaN."""
    n = len(target)
    predictions = np.full(n, np.nan)
    known = ~np.isnan(target)
    if features.shape[1] == 0 or known.sum() < MIN_TRAIN_DEVICES:
        return predictions
    for i in range(n):
        train = known.copy()
        train[i] = False
        if train.sum() < MIN_TRAIN_DEVICES - 1:
            continue
        a = features[train]
        mu = a.mean(axis=0)
        sd = a.std(axis=0) + 1e-9
        z = (a - mu) / sd
        y = target[train]
        y_mean = y.mean()
        weights = np.linalg.solve(z.T @ z + RIDGE_LAMBDA * np.eye(z.shape[1]), z.T @ (y - y_mean))
        predictions[i] = y_mean + ((features[i] - mu) / sd) @ weights
    return predictions


@lru_cache(maxsize=1)
def _feature_schema() -> dict[str, list[str]]:
    """Read the feature order exported with the six trained sensor models."""
    with (MODEL_DIR / "feature_schema.json").open(encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=6)
def _load_model(sensor: int) -> Any | None:
    """Load a trained LightGBM model only when its sensor is needed.

    Returning ``None`` keeps the API usable for a developer who has not yet
    installed the optional ML dependency; the baseline predictor remains a
    local-development fallback rather than silently blocking the dashboard.
    """
    path = MODEL_DIR / f"model_sensor{sensor}.pkl"
    if not path.exists():
        return None
    try:
        import lightgbm  # noqa: F401  # pickle needs the model's module present

        with path.open("rb") as file:
            return pickle.load(file)
    except (ImportError, ModuleNotFoundError, OSError, pickle.UnpicklingError):
        return None


def _feature_values(entry: DeviceTestResult, names: list[str]) -> list[float]:
    """Build one model row from OneAPI/CSV measurements in the saved order."""
    measured = {sensor_label(field): field.value for field in entry.results}
    coordinates = {
        "Site": entry.device.site,
        "X": entry.device.x,
        "Y": entry.device.y,
    }
    values: list[float] = []
    for name in names:
        value = coordinates.get(name, measured.get(name))
        values.append(np.nan if value is None else float(value))
    return values


def predict_with_trained_model(sensor: int, entries: list[DeviceTestResult]) -> np.ndarray | None:
    """Predict one sensor for all devices using the supplied trained model."""
    model = _load_model(sensor)
    names = _feature_schema().get(str(sensor), [])
    if model is None or not names:
        return None
    try:
        matrix = np.asarray([_feature_values(entry, names) for entry in entries], dtype=float)
        return np.asarray(model.predict(matrix), dtype=float)
    except (AttributeError, TypeError, ValueError):
        return None


def build_wafer_thermal(
    entries: list[DeviceTestResult],
    lot: str,
    wafer: str,
    is_live: bool,
    completed_sensors: int | None,
    generated_at: str,
) -> dict[str, Any] | None:
    """Build the per-device prediction matrix for one wafer.

    ``completed_sensors``: for the live wafer, how many sensors have already
    been measured (their actuals are shown; the next one is predicted; later
    ones are not predicted yet). ``None`` means everything is finished
    (historical wafer: predictions AND official results).
    """
    if not entries:
        return None

    per_device: list[dict[int, tuple[int, TestResultField]]] = []
    all_sensors: dict[int, TestResultField] = {}
    for entry in entries:
        found: dict[int, tuple[int, TestResultField]] = {}
        for position, field in enumerate(entry.results):
            idx = sensor_index(field)
            if idx is not None and field.value is not None:
                found[idx] = (position, field)
                all_sensors.setdefault(idx, field)
        per_device.append(found)
    if not all_sensors:
        return None

    sensor_ids = sorted(all_sensors)
    total = len(sensor_ids)
    done = total if completed_sensors is None else max(0, min(completed_sensors, total))
    next_sensor = sensor_ids[done] if done < total else None

    sensors_meta = []
    limits: dict[int, float | None] = {}
    for idx in sensor_ids:
        field = all_sensors[idx]
        bounds = [b for b in (field.highLimit, field.lowLimit) if b is not None]
        # The RawResult CSV's "High Limit" / "Low Limit" rows are swapped
        # (High row < Low row), so take the larger bound as the upper limit.
        upper = max(bounds) if bounds else None
        limits[idx] = upper
        stage = "verified" if sensor_ids.index(idx) < done else ("next" if idx == next_sensor else "future")
        sensors_meta.append({
            "index": idx,
            "name": sensor_label(field),
            "testNumber": field.testNumber,
            "upperLimit": upper,
            "warnThreshold": None if upper is None else upper - WARN_MARGIN,
            "unit": field.unit or DEFAULT_UNIT,
            "stage": stage,
        })

    n = len(entries)
    device_rows: list[dict[str, Any]] = [
        {
            "pid": entry.device.pid,
            "site": entry.device.site,
            "x": entry.device.x,
            "y": entry.device.y,
            "sensors": [],
        }
        for entry in entries
    ]

    for stage_position, idx in enumerate(sensor_ids):
        stage_state = "verified" if stage_position < done else ("next" if idx == next_sensor else "future")
        upper = limits[idx]
        actual = np.array([per_device[i][idx][1].value if idx in per_device[i] else np.nan for i in range(n)], dtype=float)

        predicted = np.full(n, np.nan)
        if stage_state != "future":
            trained = predict_with_trained_model(idx, entries)
            if trained is not None:
                predicted = trained
            else:
                # Only values recorded before sensor K in each device's column order.
                prefix_len = min((per_device[i][idx][0] for i in range(n) if idx in per_device[i]), default=0)
                rows = []
                for i in range(n):
                    values = [f.value for f in entries[i].results[:prefix_len]]
                    rows.append([np.nan if v is None else v for v in values])
                features = np.array(rows, dtype=float).reshape(n, prefix_len)
                usable = ~np.isnan(features).any(axis=0)
                predicted = predict_sensor(features[:, usable], actual)

        for i in range(n):
            p = None if np.isnan(predicted[i]) else float(predicted[i])
            a = None if (np.isnan(actual[i]) or stage_state != "verified") else float(actual[i])
            status = "pending" if stage_state == "future" else classify(p, upper)
            device_rows[i]["sensors"].append({
                "sensor": idx,
                "predicted": p,
                "actual": a,
                "error": None if (p is None or a is None) else a - p,
                "status": status,
                "verdict": verdict_for(status, a, upper),
            })

    return {
        "lot": lot,
        "wafer": wafer,
        "isLive": is_live,
        "generatedAt": generated_at,
        "completedSensors": done,
        "nextSensor": next_sensor,
        "sensors": sensors_meta,
        "devices": device_rows,
    }
