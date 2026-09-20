"""Cross-wafer sensor (thermal) prediction.

Flow this implements (see docs / Notion "場景二"):

  已完成的測試資料 -> 在「下一個 sensor 測試執行前」只對當下正在測的
  device 預測 -> 預測超過門檻立即產生通知 -> sensor 實測完成後回填實際值、算誤差、
  判定「預測成功 / 誤報 / 漏報」。

The model is intentionally small and explainable for the hackathon:

* Features for sensor K are only the values recorded BEFORE sensor K in the
  device's column order (earlier IDDQ/parametric columns + earlier sensors), so
  it never sees sensor K itself or anything after it (no data leakage).
* For a displayed historical/live wafer, LightGBM is trained on the other
  wafers (leave-one-wafer-out), so the selected wafer's target sensor value
  never becomes a feature or a label for its own prediction.
* For a genuinely new wafer, ``predict_next_sensor`` trains on all available
  W01-W25 rows and accepts only the prefix results already returned by the
  tester before the next sensor starts.
* A preliminary LightGBM ranks causal features and the final model keeps only
  the Top-80 schema. Warning/Critical are a separate policy layer.
"""
from __future__ import annotations

import re
from collections.abc import Iterable
import json
from pathlib import Path
import pickle
from functools import lru_cache
from typing import Any

from lightgbm import LGBMRegressor
import numpy as np

from .schemas import DeviceTestResult, TestResultField

SENSOR_NAME_RE = re.compile(r"\.sensor(\d+)$")
# The production callback may retain generated Flow/Suite names.  These are the
# stable thermal test numbers used by the training artifacts.
SENSOR_TEST_NUMBERS = {100: 1, 120: 2, 140: 3, 160: 4, 180: 5, 200: 6}
# The tester does not always emit a field for sensors that have not started
# yet.  The dashboard contract is nevertheless a fixed six-step flow, so keep
# canonical metadata for every sensor and fill in the observed limits/name when
# a real callback arrives.
SENSOR_SPECS = {
    1: (100, "Main.sensor1", "CP"),
    2: (120, "Main.sensor2", "DS0"),
    3: (140, "Main.sensor3", "IO4"),
    4: (160, "Main.sensor4", "IO1"),
    5: (180, "Main.sensor5", "IO2"),
    6: (200, "Main.sensor6", "IO3"),
}
DEFAULT_SENSOR_UPPER_LIMIT = 35.0

# Warning band below the upper limit (same unit as the sensor). This remains a
# notification policy, not a model output.
WARN_MARGIN = 0.1
MIN_TRAIN_DEVICES = 8
TOP_FEATURES = 80
DEFAULT_UNIT = "°C"  # CSV has no unit column; assumed from the task wording.
MODEL_DIR = Path(__file__).resolve().parents[1] / "training" / "models"


def sensor_index(field: TestResultField) -> int | None:
    match = SENSOR_NAME_RE.search(field.testSuiteName)
    if match:
        return int(match.group(1))
    return SENSOR_TEST_NUMBERS.get(field.testNumber)


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


def _field_key(field: TestResultField) -> tuple[int, str, str]:
    return (field.testNumber, field.testSuiteName, field.pinName or "")


def _sensor_fields(entry: DeviceTestResult) -> dict[int, tuple[int, TestResultField]]:
    return {
        index: (position, field)
        for position, field in enumerate(entry.results)
        if (index := sensor_index(field)) is not None and field.value is not None
    }


def _feature_descriptors(entries: Iterable[DeviceTestResult], target_sensor: int) -> list[tuple[str, tuple[int, str, str] | None]]:
    """Build causal prefix features plus physical/context transforms."""
    for entry in entries:
        sensor = _sensor_fields(entry).get(target_sensor)
        if sensor:
            position, _ = sensor
            prefix = [_field_key(field) for field in entry.results[:position]]
            descriptors: list[tuple[str, tuple[int, str, str] | None]] = [("raw", key) for key in prefix]
            descriptors.extend(("log_iddq", key) for key in prefix if "iddq" in key[1].lower())
            descriptors.append(("touchdown_index", None))
            return descriptors
    return []


def _feature_matrix(
    entries: list[DeviceTestResult],
    descriptors: list[tuple[str, tuple[int, str, str] | None]],
) -> np.ndarray:
    if not entries:
        return np.empty((0, len(descriptors)), dtype=float)
    ordered = sorted(entries, key=lambda entry: (entry.device.wafer, entry.device.testTime, entry.device.pid))
    touchdown = {id(entry): index for index, entry in enumerate(ordered)}
    rows: list[list[float]] = []
    for entry in entries:
        values = {_field_key(field): field.value for field in entry.results if field.value is not None}
        row: list[float] = []
        for kind, key in descriptors:
            if kind == "touchdown_index":
                row.append(float(touchdown[id(entry)]))
                continue
            value = values.get(key) if key is not None else None
            if value is None:
                row.append(np.nan)
            elif kind == "log_iddq":
                row.append(float(np.log(max(abs(float(value)), 1e-12))))
            else:
                row.append(float(value))
        rows.append(row)
    return np.asarray(rows, dtype=float)


def _select_top_features(train_x: np.ndarray, y: np.ndarray, descriptors: list[tuple[str, tuple[int, str, str] | None]]) -> list[int]:
    usable = ~np.isnan(train_x).all(axis=0)
    if not usable.any():
        return []
    x = train_x[:, usable]
    model = LGBMRegressor(
        objective="huber",
        n_estimators=100,
        learning_rate=0.05,
        num_leaves=10,
        min_child_samples=20,
        reg_lambda=5.0,
        colsample_bytree=0.75,
        verbosity=-1,
        force_col_wise=True,
        random_state=42,
    )
    model.fit(x, y)
    candidates = np.flatnonzero(usable)
    ranked = candidates[np.argsort(model.feature_importances_)[::-1]]
    return ranked[: min(TOP_FEATURES, len(ranked))].tolist()


def _fit_lightgbm(train_x: np.ndarray, y: np.ndarray, selected: list[int]) -> LGBMRegressor:
    x = train_x[:, selected]
    model = LGBMRegressor(
        objective="huber",
        n_estimators=240,
        learning_rate=0.035,
        num_leaves=10,
        min_child_samples=20,
        reg_lambda=5.0,
        colsample_bytree=0.7,
        verbosity=-1,
        force_col_wise=True,
        random_state=42,
    )
    model.fit(x, y)
    return model


def _sanitize_feature_name(name: str) -> str:
    return re.sub(r"[\[\]\{\}:\",]", "_", name)


@lru_cache(maxsize=6)
def _production_artifact(sensor: int) -> tuple[LGBMRegressor, list[str]] | None:
    model_path = MODEL_DIR / f"model_sensor{sensor}.pkl"
    schema_path = MODEL_DIR / "feature_schema.json"
    if not model_path.is_file() or not schema_path.is_file():
        return None
    try:
        with model_path.open("rb") as file:
            model = pickle.load(file)
        schemas = json.loads(schema_path.read_text(encoding="utf-8"))
        return model, [str(name) for name in schemas[str(sensor)]]
    except (OSError, ValueError, KeyError, pickle.PickleError, AttributeError):
        return None


def _production_feature_matrix(
    all_entries: list[DeviceTestResult],
    target_entries: list[DeviceTestResult],
    schema: list[str],
) -> np.ndarray:
    """Recreate the uploaded training notebook's feature schema for inference."""
    raw_by_entry: dict[int, dict[str, float]] = {}
    touchdown_by_entry: dict[int, int] = {}
    for entry in all_entries:
        raw: dict[str, float] = {}
        for field in entry.results:
            if field.value is None:
                continue
            key = f"{field.testNumber}_{field.testSuiteName}"
            if field.pinName:
                key += f"#{field.pinName}"
            raw[_sanitize_feature_name(key)] = float(field.value)
        raw_by_entry[id(entry)] = raw
        try:
            touchdown_by_entry[id(entry)] = max((int(entry.device.pid) - 1) // 4, 0)
        except ValueError:
            touchdown_by_entry[id(entry)] = len(touchdown_by_entry) // 4

    iddq_key = _sanitize_feature_name("80000_Main.IDDQ_flow.IDDQ_A1#IO1")
    group_values: dict[tuple[str, int], list[float]] = {}
    for entry in all_entries:
        value = raw_by_entry[id(entry)].get(iddq_key)
        if value is not None:
            group_values.setdefault((entry.device.wafer, touchdown_by_entry[id(entry)]), []).append(value)

    rows: list[list[float]] = []
    for entry in target_entries:
        raw = raw_by_entry[id(entry)]
        touchdown = touchdown_by_entry[id(entry)]
        group = group_values.get((entry.device.wafer, touchdown), [])
        values: dict[str, float] = {
            "Site": float(entry.device.site),
            "X": float(entry.device.x),
            "Y": float(entry.device.y),
            "Touchdown_Idx": float(touchdown),
        }
        if group:
            mean_iddq = sum(group) / len(group)
            values["Touchdown_Mean_IDDQ_A1"] = mean_iddq
            if iddq_key in raw:
                values["Site_Relative_IDDQ_A1"] = raw[iddq_key] - mean_iddq
        for key, value in raw.items():
            values[key] = value
            if "IDDQ" in key:
                values[f"log_{key}"] = float(np.log(max(abs(value), 1e-3)))
        rows.append([values.get(name, np.nan) for name in schema])
    return np.asarray(rows, dtype=float)


def production_model_info() -> dict[str, Any] | None:
    feature_counts = []
    for sensor in range(1, 7):
        artifact = _production_artifact(sensor)
        if artifact is None:
            return None
        feature_counts.append(len(artifact[1]))
    return {
        "name": "LightGBM",
        "objective": "sensor-specific LightGBM regression",
        "featureSchema": "Top-80 causal features",
        "featureCounts": feature_counts,
        "modelDirectory": "backend/training/models",
    }


def fit_cross_wafer_predictor(
    training_entries: list[DeviceTestResult],
    target_entries: list[DeviceTestResult],
    target_sensor: int,
    *,
    target_entry: DeviceTestResult | None = None,
    use_production_model: bool = False,
) -> np.ndarray:
    """Train a causal Top-80 LightGBM regressor and predict target rows.

    Only columns before the target sensor are eligible. Feature selection and
    fitting both use training wafers only, so a held-out wafer cannot leak into
    the schema or model. Missing prefix values are median-imputed from training.
    """
    target_rows = target_entries if target_entries else ([target_entry] if target_entry else [])
    if use_production_model or target_entry is not None:
        artifact = _production_artifact(target_sensor)
        if artifact is not None:
            model, schema = artifact
            matrix = _production_feature_matrix(training_entries + target_rows, target_rows, schema)
            predictor = getattr(model, "booster_", model)
            return np.asarray(predictor.predict(matrix), dtype=float)

    descriptors = _feature_descriptors(training_entries, target_sensor)
    if not descriptors:
        return np.full(len(target_entries) if target_entries else 1, np.nan)

    train_x = _feature_matrix(training_entries, descriptors)
    target_x = _feature_matrix(target_rows, descriptors)
    labels: list[float] = []
    label_rows: list[int] = []
    for row_index, entry in enumerate(training_entries):
        field = _sensor_fields(entry).get(target_sensor)
        if field and field[1].value is not None:
            label_rows.append(row_index)
            labels.append(float(field[1].value))
    output_size = len(target_rows) if target_rows else 1
    if not label_rows or train_x.shape[1] == 0:
        return np.full(output_size, np.nan)

    train_x = train_x[label_rows]
    y = np.asarray(labels, dtype=float)
    if len(y) < MIN_TRAIN_DEVICES:
        return np.full(output_size, np.nan)
    selected = _select_top_features(train_x, y, descriptors)
    if not selected:
        return np.full(output_size, np.nan)
    train_x = train_x[:, selected]
    target_x = target_x[:, selected]
    column_means = np.nanmean(train_x, axis=0)
    train_x = np.where(np.isnan(train_x), column_means, train_x)
    target_x = np.where(np.isnan(target_x), column_means, target_x)
    model = _fit_lightgbm(train_x, y, list(range(train_x.shape[1])))
    return model.predict(target_x)


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
    # A live dashboard must describe the device currently under test, not
    # retrospectively predict every completed device on the wafer.  The bridge
    # creates one short-lived LIVE-S<site> row per active site and replaces it
    # with the genuine TESTEND record when that device finishes.
    if is_live:
        active_entries = [
            entry for entry in target_entries if entry.device.pid.startswith("LIVE-S")
        ]
        if active_entries:
            target_entries = active_entries
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

    # Always return all six columns.  Using only ``all_sensors`` made sensors
    # 5/6 disappear from the UI until their callback arrived.
    sensor_ids = list(SENSOR_SPECS)
    total = len(sensor_ids)
    done = total if completed_sensors is None else max(0, min(completed_sensors, total))
    next_sensor = sensor_ids[done] if done < total else None

    sensors_meta = []
    limits: dict[int, float | None] = {}
    for idx in sensor_ids:
        field = all_sensors.get(idx)
        bounds = [b for b in (field.highLimit, field.lowLimit) if b is not None] if field else []
        # The RawResult CSV's "High Limit" / "Low Limit" rows are swapped
        # (High row < Low row), so take the larger bound as the upper limit.
        upper = max(bounds) if bounds else DEFAULT_SENSOR_UPPER_LIMIT
        limits[idx] = upper
        stage = "verified" if sensor_ids.index(idx) < done else ("next" if idx == next_sensor else "future")
        test_number, suite_name, pin_name = SENSOR_SPECS[idx]
        sensors_meta.append({
            "index": idx,
            "name": sensor_label(field) if field else f"{test_number}_{suite_name}#{pin_name}",
            "testNumber": field.testNumber if field else test_number,
            "upperLimit": upper,
            "warnThreshold": None if upper is None else upper - WARN_MARGIN,
            "unit": field.unit if field and field.unit else DEFAULT_UNIT,
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
            predicted = fit_cross_wafer_predictor(
                training_entries,
                target_entries,
                idx,
                use_production_model=is_live,
            )

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
        "model": production_model_info(),
    }
