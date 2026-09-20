"""Evaluate the production thermal baseline with wafer-level isolation.

Examples (from the fullstack repo root)::

    python backend/scripts/validate_thermal_model.py
    python backend/scripts/validate_thermal_model.py --eval-dir path/to/eval

Without ``--eval-dir``, each W01-W25 fold is treated as an unseen wafer. This
is the correct offline proxy for the new-wafer scenario because the target
wafer is excluded from training. An independent evaluation directory can be
provided when the organizers supply held-out wafer logs.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app import csv_import  # noqa: E402
from app.csv_import import import_csv  # noqa: E402
from app.schemas import DeviceTestResult  # noqa: E402
from app.state import RuntimeState  # noqa: E402
from app.thermal import (  # noqa: E402
    DEFAULT_UNIT,
    WARN_MARGIN,
    classify,
    fit_cross_wafer_predictor,
    sensor_index,
    sensor_label,
    verdict_for,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def wafer_from_path(path: Path) -> str:
    token = path.stem.split("_W")[-1].split("_")[0]
    return f"W{int(token):02d}"


def load_csvs(data_dir: Path, *, lot: str, state: RuntimeState) -> list[DeviceTestResult]:
    """Load CSVs through the same adapter as the running API."""
    paths = sorted(data_dir.glob("A12345_W*_RawResult.csv"))
    if not paths:
        raise SystemExit(f"No A12345_W*_RawResult.csv files found in {data_dir}")

    original_state = csv_import.runtime_state
    csv_import.runtime_state = state
    try:
        for index, path in enumerate(paths):
            import_csv(
                str(path),
                lot_override=lot,
                wafer_override=wafer_from_path(path),
                reset=index == 0,
                measurement_limit=24,
            )
    finally:
        csv_import.runtime_state = original_state
    return [entry.model_copy(deep=True) for entry in state.devices]


def sensor_meta(entries: list[DeviceTestResult]) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for entry in entries:
        for field in entry.results:
            index = sensor_index(field)
            if index is None or index in result:
                continue
            bounds = [value for value in (field.highLimit, field.lowLimit) if value is not None]
            result[index] = {
                "index": index,
                "name": sensor_label(field),
                "unit": field.unit or DEFAULT_UNIT,
                "upperLimit": max(bounds) if bounds else None,
            }
    return dict(sorted(result.items()))


def metric(values: list[float]) -> dict[str, float | int | None]:
    if not values:
        return {"samples": 0, "mae": None, "rmse": None, "sumAbsError": 0.0, "sumSquaredError": 0.0}
    errors = np.asarray(values, dtype=float)
    return {
        "samples": int(errors.size),
        "mae": float(np.mean(np.abs(errors))),
        "rmse": float(math.sqrt(np.mean(errors**2))),
        "sumAbsError": float(np.sum(np.abs(errors))),
        "sumSquaredError": float(np.sum(errors**2)),
    }


def evaluate_fold(
    training_entries: list[DeviceTestResult],
    target_entries: list[DeviceTestResult],
    metadata: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    by_sensor: dict[int, dict[str, Any]] = {}
    for index, meta in metadata.items():
        predictions = fit_cross_wafer_predictor(training_entries, target_entries, index)
        errors: list[float] = []
        counts = {"hit": 0, "falseAlarm": 0, "miss": 0, "ok": 0, "unclassified": 0}
        samples = 0
        for row_index, entry in enumerate(target_entries):
            target_field = next(
                (field for field in entry.results if sensor_index(field) == index and field.value is not None),
                None,
            )
            if target_field is None or row_index >= len(predictions) or np.isnan(predictions[row_index]):
                counts["unclassified"] += 1
                continue
            actual = float(target_field.value)
            predicted = float(predictions[row_index])
            errors.append(actual - predicted)
            samples += 1
            prediction_status = classify(predicted, meta["upperLimit"])
            verdict = verdict_for(prediction_status, actual, meta["upperLimit"])
            if verdict is None:
                counts["unclassified"] += 1
            else:
                counts[verdict if verdict in {"hit", "ok"} else {"false_alarm": "falseAlarm", "miss": "miss"}[verdict]] += 1

        stats = metric(errors)
        classified = counts["hit"] + counts["falseAlarm"] + counts["miss"] + counts["ok"]
        stats.update({
            "accuracy": (counts["hit"] + counts["ok"]) / classified if classified else None,
            "predictedAlerts": counts["hit"] + counts["falseAlarm"],
            "actualAlerts": counts["hit"] + counts["miss"],
            **counts,
        })
        by_sensor[str(index)] = {**meta, **stats}
    return by_sensor


def aggregate(sensor_reports: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for report in sensor_reports:
        for index, item in report.items():
            grouped[index].append(item)

    result: dict[str, Any] = {}
    for index, folds in sorted(grouped.items(), key=lambda item: int(item[0])):
        counts = {"hit": 0, "falseAlarm": 0, "miss": 0, "ok": 0, "unclassified": 0}
        samples = 0
        sum_abs_error = 0.0
        sum_squared_error = 0.0
        for fold in folds:
            for key in counts:
                counts[key] += int(fold.get(key, 0))
            samples += int(fold.get("samples", 0))
            sum_abs_error += float(fold.get("sumAbsError", 0.0))
            sum_squared_error += float(fold.get("sumSquaredError", 0.0))
        stats = {
            "samples": samples,
            "mae": sum_abs_error / samples if samples else None,
            "rmse": math.sqrt(sum_squared_error / samples) if samples else None,
            "sumAbsError": sum_abs_error,
            "sumSquaredError": sum_squared_error,
        }
        classified = counts["hit"] + counts["falseAlarm"] + counts["miss"] + counts["ok"]
        first = folds[0]
        result[index] = {
            "index": int(index),
            "name": first["name"],
            "unit": first["unit"],
            "upperLimit": first["upperLimit"],
            "samples": sum(int(fold.get("samples", 0)) for fold in folds),
            "mae": stats["mae"],
            "rmse": stats["rmse"],
            "sumAbsError": stats["sumAbsError"],
            "sumSquaredError": stats["sumSquaredError"],
            "accuracy": (counts["hit"] + counts["ok"]) / classified if classified else None,
            "predictedAlerts": counts["hit"] + counts["falseAlarm"],
            "actualAlerts": counts["hit"] + counts["miss"],
            **counts,
        }
    return result


def to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Thermal Prediction Validation Report",
        "",
        f"- Generated: `{report['generatedAt']}`",
        f"- Training wafers: `{', '.join(report['dataset']['trainingWafers'])}`",
        f"- Alert rule for validation: predicted/actual value >= upper limit - `{report['config']['warnMargin']} °C`",
        "- Validation design: Leave-One-Wafer-Out (the target wafer is excluded from training)",
        "",
        "## Sensor summary",
        "",
        "| Sensor | Samples | MAE (°C) | RMSE (°C) | Accuracy | Hit | False alarm | Miss | Normal match |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for item in report["sensorSummary"].values():
        lines.append(
            f"| `{item['name']}` | {item['samples']} | {item['mae']:.4f} | {item['rmse']:.4f} | "
            f"{item['accuracy']:.2%} | {item['hit']} | {item['falseAlarm']} | {item['miss']} | {item['ok']} |"
        )

    lines += ["", "## Overall", ""]
    overall = report["overall"]
    lines.append(
        f"- Samples: `{overall['samples']}`; MAE: `{overall['mae']:.4f} °C`; "
        f"RMSE: `{overall['rmse']:.4f} °C`; accuracy: `{overall['accuracy']:.2%}`"
    )
    lines.append(
        f"- Hit `{overall['hit']}`, false alarm `{overall['falseAlarm']}`, "
        f"miss `{overall['miss']}`, normal match `{overall['ok']}`"
    )
    lines += ["", "## New-wafer evaluation", ""]
    new_wafer = report["newWaferEvaluation"]
    lines.append(f"- Status: **{new_wafer['status']}**")
    lines.append(f"- {new_wafer['note']}")
    if new_wafer.get("sensorSummary"):
        lines += ["", "| Sensor | Samples | MAE (°C) | RMSE (°C) | Accuracy |", "|---|---:|---:|---:|---:|"]
        for item in new_wafer["sensorSummary"].values():
            lines.append(f"| `{item['name']}` | {item['samples']} | {item['mae']:.4f} | {item['rmse']:.4f} | {item['accuracy']:.2%} |")

    lines += ["", "## Per-wafer LOO results", "", "| Wafer | Sensor | Samples | MAE (°C) | RMSE (°C) | Accuracy | Hit | False alarm | Miss |", "|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for wafer, sensors in report["waferFolds"].items():
        for item in sensors.values():
            lines.append(f"| `{wafer}` | `{item['name']}` | {item['samples']} | {item['mae']:.4f} | {item['rmse']:.4f} | {item['accuracy']:.2%} | {item['hit']} | {item['falseAlarm']} | {item['miss']} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run cross-wafer thermal model validation.")
    parser.add_argument("--data-dir", type=Path, default=REPO_DIR / "training" / "Data")
    parser.add_argument("--eval-dir", type=Path, default=None, help="Optional independent new-wafer CSV directory")
    parser.add_argument("--out-dir", type=Path, default=BACKEND_DIR / "reports")
    args = parser.parse_args()

    training_state = RuntimeState()
    training_entries = load_csvs(args.data_dir, lot="A12345", state=training_state)
    training_wafers = sorted({entry.device.wafer for entry in training_entries})
    metadata = sensor_meta(training_entries)
    by_wafer: dict[str, list[DeviceTestResult]] = defaultdict(list)
    for entry in training_entries:
        by_wafer[entry.device.wafer].append(entry)

    folds: dict[str, dict[str, Any]] = {}
    fold_reports = []
    for wafer in training_wafers:
        target = by_wafer[wafer]
        train = [entry for other, entries in by_wafer.items() if other != wafer for entry in entries]
        fold = evaluate_fold(train, target, metadata)
        folds[wafer] = fold
        fold_reports.append(fold)

    sensor_summary = aggregate(fold_reports)
    total_counts = {"hit": 0, "falseAlarm": 0, "miss": 0, "ok": 0, "unclassified": 0}
    total_samples = 0
    total_abs_error = 0.0
    total_squared_error = 0.0
    for item in sensor_summary.values():
        total_samples += int(item["samples"])
        total_abs_error += float(item.get("sumAbsError", 0.0))
        total_squared_error += float(item.get("sumSquaredError", 0.0))
        for key in total_counts:
            total_counts[key] += int(item[key])
    overall_metric = {
        "samples": total_samples,
        "mae": total_abs_error / total_samples if total_samples else None,
        "rmse": math.sqrt(total_squared_error / total_samples) if total_samples else None,
        "sumAbsError": total_abs_error,
        "sumSquaredError": total_squared_error,
    }
    classified = sum(total_counts[key] for key in ("hit", "falseAlarm", "miss", "ok"))
    overall = {
        **overall_metric,
        "accuracy": (total_counts["hit"] + total_counts["ok"]) / classified if classified else None,
        "predictedAlerts": total_counts["hit"] + total_counts["falseAlarm"],
        "actualAlerts": total_counts["hit"] + total_counts["miss"],
        **total_counts,
    }

    new_wafer: dict[str, Any] = {
        "status": "simulated_by_loo",
        "note": "沒有獨立的新 wafer CSV；以上 W01-W25 的每一折都把目標 wafer 當成未見過的新 wafer。",
    }
    if args.eval_dir:
        eval_state = RuntimeState()
        eval_entries = load_csvs(args.eval_dir, lot="EVAL", state=eval_state)
        new_wafer["status"] = "measured_eval_csv"
        new_wafer["note"] = f"使用獨立評估資料夾 `{args.eval_dir}`；模型只用 W01-W25 訓練。"
        new_wafer["sensorSummary"] = aggregate([evaluate_fold(training_entries, eval_entries, metadata)])

    report = {
        "generatedAt": now_iso(),
        "dataset": {
            "trainingWafers": training_wafers,
            "trainingDevices": len(training_entries),
            "sensorCount": len(metadata),
        },
        "config": {"warnMargin": WARN_MARGIN, "model": "cross-wafer Ridge regression", "measurementLimit": 24},
        "sensorSummary": sensor_summary,
        "overall": overall,
        "waferFolds": folds,
        "newWaferEvaluation": new_wafer,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.out_dir / "thermal_validation.json"
    markdown_path = args.out_dir / "thermal_validation.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(to_markdown(report), encoding="utf-8")
    print(f"wrote {json_path}")
    print(f"wrote {markdown_path}")
    print(json.dumps({"overall": overall, "sensors": sensor_summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
