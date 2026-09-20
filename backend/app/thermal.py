"""Cross-wafer sensor (thermal) prediction.

Flow this implements (see docs / Notion "場景二"):

  已完成的測試資料 -> 在「下一個 sensor 測試執行前」對整片 wafer 的每個 device
  分別預測 -> 預測超過門檻立即產生通知 -> sensor 實測完成後回填實際值、算誤差、
  判定「預測成功 / 誤報 / 漏報」。

The model is intentionally small and explainable for the hackathon:

* Features for sensor K are only the values recorded BEFORE sensor K in the
  device's column order (earlier IDDQ/parametric columns + earlier sensors), so
  it never sees sensor K itself or anything after it (no data leakage).
* For a displayed historical/live wafer, Ridge regression is trained on the
  other wafers (leave-one-wafer-out), so the selected wafer's target sensor
  value never becomes a feature or a label for its own prediction.
* For a genuinely new wafer, ``predict_next_sensor`` trains on all available
  W01-W25 rows and accepts only the prefix results already returned by the
  tester before the next sensor starts.
* The model output is numeric. Warning/Critical are a separate policy layer.
"""
from __future__ import annotations

import re
from collections.abc import Iterable
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


def _field_key(field: TestResultField) -> tuple[int, str, str]:
    return (field.testNumber, field.testSuiteName, field.pinName or "")


def _sensor_fields(entry: DeviceTestResult) -> dict[int, tuple[int, TestResultField]]:
    return {
        index: (position, field)
        for position, field in enumerate(entry.results)
        if (index := sensor_index(field)) is not None and field.value is not None
    }


def _feature_keys(entries: Iterable[DeviceTestResult], target_sensor: int) -> list[tuple[int, str, str]]:
    """Stable prefix columns for a sensor, based on the CSV test order."""
    for entry in entries:
        sensor = _sensor_fields(entry).get(target_sensor)
        if sensor:
            position, _ = sensor
            return [_field_key(field) for field in entry.results[:position]]
    return []


def _feature_matrix(
    entries: list[DeviceTestResult],
    keys: list[tuple[int, str, str]],
) -> np.ndarray:
    rows: list[list[float]] = []
    for entry in entries:
        values = {_field_key(field): field.value for field in entry.results if field.value is not None}
        rows.append([np.nan if values.get(key) is None else float(values[key]) for key in keys])
    if not rows:
        return np.empty((0, len(keys)), dtype=float)
    return np.asarray(rows, dtype=float)


def fit_cross_wafer_predictor(
    training_entries: list[DeviceTestResult],
    target_entries: list[DeviceTestResult],
    target_sensor: int,
    *,
    target_entry: DeviceTestResult | None = None,
) -> np.ndarray:
    """Train on complete wafers and predict the target wafer/device rows.

    Missing prefix values are imputed from the training columns. This keeps the
    API usable while a tester is still streaming measurements, when a few
    optional parametric items may not have arrived for every device.
    """
    keys = _feature_keys(target_entries or ([target_entry] if target_entry else []), target_sensor)
    if not keys:
        keys = _feature_keys(training_entries, target_sensor)
    if not keys:
        return np.full(len(target_entries) if target_entries else 1, np.nan)

    train_x = _feature_matrix(training_entries, keys)
    target_x = _feature_matrix(target_entries, keys) if target_entries else _feature_matrix([target_entry], keys)  # type: ignore[list-item]
    labels: list[float] = []
    label_rows: list[int] = []
    for row_index, entry in enumerate(training_entries):
        field = _sensor_fields(entry).get(target_sensor)
        if field and field[1].value is not None:
            label_rows.append(row_index)
            labels.append(float(field[1].value))
    if not label_rows or train_x.shape[1] == 0:
        return np.full(len(target_entries) if target_entries else 1, np.nan)

    train_x = train_x[label_rows]
    y = np.asarray(labels, dtype=float)
    usable_columns = ~np.isnan(train_x).all(axis=0)
    if not usable_columns.any() or len(y) < MIN_TRAIN_DEVICES:
        return np.full(len(target_entries) if target_entries else 1, np.nan)
    train_x = train_x[:, usable_columns]
    target_x = target_x[:, usable_columns]
    column_means = np.nanmean(train_x, axis=0)
    train_x = np.where(np.isnan(train_x), column_means, train_x)
    target_x = np.where(np.isnan(target_x), column_means, target_x)
    mu = train_x.mean(axis=0)
    sd = train_x.std(axis=0) + 1e-9
    z = (train_x - mu) / sd
    weights = np.linalg.solve(z.T @ z + RIDGE_LAMBDA * np.eye(z.shape[1]), z.T @ (y - y.mean()))
    return y.mean() + ((target_x - mu) / sd) @ weights


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
    target_entries = [entry for entry in entries if entry.device.wafer == wafer]
    if not target_entries:
        return None

    per_device: list[dict[int, tuple[int, TestResultField]]] = []
    all_sensors: dict[int, TestResultField] = {}
    for entry in target_entries:
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

    n = len(target_entries)
    device_rows: list[dict[str, Any]] = [
        {
            "pid": entry.device.pid,
            "site": entry.device.site,
            "x": entry.device.x,
            "y": entry.device.y,
            "sensors": [],
        }
        for entry in target_entries
    ]

    for stage_position, idx in enumerate(sensor_ids):
        stage_state = "verified" if stage_position < done else ("next" if idx == next_sensor else "future")
        upper = limits[idx]
        actual = np.array([per_device[i][idx][1].value if idx in per_device[i] else np.nan for i in range(n)], dtype=float)

        predicted = np.full(n, np.nan)
        if stage_state != "future":
            # Only values recorded before sensor K in each device's column order.
            training_entries = [entry for entry in entries if entry.device.wafer != wafer]
            predicted = fit_cross_wafer_predictor(training_entries, target_entries, idx)

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
