from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from math import sqrt
from threading import RLock
from typing import Any, Callable

import numpy as np

from .bin_labels import bin_label, hard_bin_label
from .events import derive_fail_events, event_id
from .alert_manager import AlertManager
from .anomaly_engine import AnomalyEngine
from .models import Measurement as AnomalyMeasurement
from .schemas import DeviceInfo, DeviceTestResult, Measurement, TestResultField
from .thermal import (
    DEFAULT_UNIT,
    build_wafer_thermal,
    classify,
    fit_cross_wafer_predictor,
    sensor_index,
    sensor_label,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def std_dev(values: list[float]) -> float:
    if not values:
        return 0.0
    average = mean(values)
    return sqrt(sum((value - average) ** 2 for value in values) / len(values))


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    return ordered[mid] if n % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def percentile(sorted_values: list[float], fraction: float) -> float:
    """Linear-interpolation percentile (matches numpy's default 'linear' method)."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    index = fraction * (len(sorted_values) - 1)
    lower = int(index)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = index - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * weight


def five_number_summary(values: list[float]) -> list[float] | None:
    """[min, Q1, median, Q3, max] for the Site Imbalance Boxplot.

    This is the real per-device distribution, not the mean/stdDev
    normal-distribution approximation the frontend previously had to fall
    back to (see estimateBoxplotDist() in frontend/src/lib/theme.ts) — that
    approximation is still kept there as a fallback for whenever this field
    is missing (e.g. fewer than 2 raw values), but this is the accurate one.
    """
    if len(values) < 2:
        return None
    ordered = sorted(values)
    return [
        ordered[0],
        percentile(ordered, 0.25),
        percentile(ordered, 0.5),
        percentile(ordered, 0.75),
        ordered[-1],
    ]


@dataclass
class RuntimeState:
    """Thread-safe boundary between OneAPI callbacks and the web server.

    OneAPI invokes callbacks on its own thread.  This object only copies the
    small fields needed by the dashboard, so callback-owned SDK data is never
    retained after the callback returns.
    """

    lot: str = "-"
    wafer: str = "-"
    wafer_radius: int = 20
    devices: list[DeviceTestResult] = field(default_factory=list)
    pending_measurements: dict[int, list[Measurement]] = field(
        default_factory=lambda: defaultdict(list)
    )
    # 即時 wafer 已完成幾個 sensor 測試（ONEAPI 串接後應由收到的 sensor 量測事件
    # 推算；CSV 匯入時所有數值一次到齊，所以用 /api/internal/thermal-progress
    # 模擬進度）。沒設定時從 sensor1 開始，避免介面一進來就跳到 sensor4。
    thermal_completed: dict[tuple[str, str], int] = field(default_factory=dict)
    anomaly_engine: AnomalyEngine = field(default_factory=AnomalyEngine, repr=False)
    alert_manager: AlertManager = field(default_factory=AlertManager, repr=False)
    live_alerts: list[dict[str, Any]] = field(default_factory=list, repr=False)
    anomaly_revision: int = field(default=0, repr=False)
    cached_anomaly_revision: int = field(default=-1, repr=False)
    cached_anomaly_alerts: list[dict[str, Any]] = field(default_factory=list, repr=False)
    last_wafer_report: dict[str, Any] | None = field(default=None, repr=False)
    lock: RLock = field(default_factory=RLock, repr=False)

    def start_lot(self, lot: str) -> None:
        with self.lock:
            self.lot = lot
            self.wafer = "-"
            self.devices.clear()
            self.pending_measurements.clear()
            self.live_alerts.clear()
            self.anomaly_revision += 1
            self.cached_anomaly_revision = -1
            self.cached_anomaly_alerts.clear()
            self.last_wafer_report = None

    def start_wafer(self, wafer: str, radius: int = 20) -> None:
        with self.lock:
            self.wafer = wafer
            self.wafer_radius = radius
            self.anomaly_revision += 1
            self.cached_anomaly_revision = -1
            self.cached_anomaly_alerts.clear()

    def finish_wafer(self) -> dict[str, Any]:
        """Freeze the current wafer summary when ONEAPI emits WAFEREND."""
        report = {
            "generatedAt": now_iso(),
            "lot": self.lot,
            "wafer": self.wafer,
            "alerts": self.anomaly_alerts(),
            "devices": len(self.devices),
        }
        with self.lock:
            self.last_wafer_report = report
        return report

    def record_measurement(self, measurement: Measurement, set_message=None) -> None:
        with self.lock:
            if not self.lot or self.lot == "-":
                self.lot = "LOT-UNKNOWN"
            if not self.wafer or self.wafer == "-":
                self.wafer = "FT"
            self.pending_measurements[measurement.site].append(measurement)
            field = measurement_to_result(measurement)
            # A stage is completed only when every active site has emitted it.
            # Taking the current site's count made the UI jump backwards while
            # sites reported the same sensor out of order.
            sensor_sets = []
            for pending in self.pending_measurements.values():
                detected = {sensor_index(measurement_to_result(item)) for item in pending}
                sensor_sets.append({sensor for sensor in detected if sensor is not None})
            if sensor_sets:
                self.thermal_completed[(self.lot, self.wafer)] = min(
                    len(sensors) for sensors in sensor_sets
                )

            # Production FT flows can omit TESTEND.  Keep an in-progress row
            # visible, then replace it as soon as the genuine terminal event
            # is received.
            provisional_pid = f"LIVE-S{measurement.site}"
            provisional = next((
                entry for entry in self.devices
                if entry.device.pid == provisional_pid
                and entry.device.lot == self.lot
                and entry.device.wafer == self.wafer
            ), None)
            if provisional is None:
                provisional = DeviceTestResult(device=DeviceInfo(
                    pid=provisional_pid, lot=self.lot, wafer=self.wafer,
                    site=measurement.site, x=0, y=0,
                    pf="PASS" if measurement.passed else "FAIL",
                    softBin=1 if measurement.passed else 0,
                    hardBin=1 if measurement.passed else 0,
                    testTime=now_iso(),
                ))
                self.devices.append(provisional)
            provisional.results.append(field)
            provisional.failEvents = derive_fail_events(provisional.results)
            if not measurement.passed:
                provisional.device.pf = "FAIL"
            alert_measurement = AnomalyMeasurement(
                tester_id="testerA",
                lot_id=self.lot,
                wafer_id=self.wafer,
                site=measurement.site,
                test_name=measurement.testSuiteName,
                value=measurement.value or 0.0,
                unit=measurement.unit,
                low_limit=measurement.lowLimit,
                high_limit=measurement.highLimit,
                passed=measurement.passed,
            )
            for alert in self.anomaly_engine.evaluate_measurement(alert_measurement).alerts:
                if self.alert_manager.publish(alert, set_message):
                    self.live_alerts.append(alert.as_dict())
            self.live_alerts = self.live_alerts[-100:]

    def record_test_end(self, result: DeviceTestResult) -> None:
        with self.lock:
            # Parametric callbacks normally arrive before TESTEND.  Merge and
            # clear only this site's temporary buffer at the terminal event.
            measurements = self.pending_measurements.pop(result.device.site, [])
            result.results.extend(
                measurement_to_result(measurement) for measurement in measurements
            )
            if not result.failEvents:
                result.failEvents = derive_fail_events(result.results)
            self.devices = [entry for entry in self.devices if not (
                entry.device.pid == f"LIVE-S{result.device.site}"
                and entry.device.lot == result.device.lot
                and entry.device.wafer == result.device.wafer
            )]
            self.devices.append(result)
            self.lot = result.device.lot or self.lot
            self.wafer = result.device.wafer or self.wafer
            self.devices = self.devices[-2_000:]
            self.anomaly_revision += 1
            self.cached_anomaly_revision = -1

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            devices = [entry.model_copy(deep=True) for entry in self.devices]
            lot = self.lot
            wafer = self.wafer
        # CSV mock 會把 W01~W25 一起載入 runtime；Dashboard 顯示的是目前
        # 選中的 wafer，Lot Summary 才負責跨 wafer 彙總。
        current_devices = [entry for entry in devices if entry.device.wafer == wafer] if wafer != "-" else devices
        return build_snapshot(current_devices, lot, wafer, self.anomaly_alerts())

    def anomaly_alerts(self) -> list[dict[str, Any]]:
        with self.lock:
            if self.cached_anomaly_revision == self.anomaly_revision:
                return self.live_alerts[-100:] + self.cached_anomaly_alerts
            devices = [entry.model_copy(deep=True) for entry in self.devices]
            lot = self.lot
            wafer = self.wafer
        measurements = []
        for touchdown_index, entry in enumerate(devices):
            for result in entry.results:
                if result.value is None:
                    continue
                measurements.append(AnomalyMeasurement(
                    tester_id="testerA",
                    lot_id=entry.device.lot or lot,
                    wafer_id=entry.device.wafer or wafer,
                    site=entry.device.site,
                    test_name=result.testSuiteName,
                    value=result.value,
                    unit=result.unit,
                    low_limit=result.lowLimit,
                    high_limit=result.highLimit,
                    touchdown_index=touchdown_index,
                    x=entry.device.x,
                    y=entry.device.y,
                    soft_bin=entry.device.softBin,
                    hard_bin=entry.device.hardBin,
                    passed=result.pass_,
                ))
        alerts = [alert.as_dict() for alert in self.anomaly_engine.evaluate_wafer(measurements).alerts]
        with self.lock:
            if self.anomaly_revision == self.cached_anomaly_revision:
                return self.live_alerts[-100:] + self.cached_anomaly_alerts
            self.cached_anomaly_alerts = alerts
            self.cached_anomaly_revision = self.anomaly_revision
            return self.live_alerts[-100:] + alerts

    def alerts(self) -> list[dict[str, Any]]:
        return self.anomaly_alerts()
    def site_summaries(self) -> list[dict[str, Any]]:
        with self.lock:
            devices = [entry.model_copy(deep=True) for entry in self.devices]
        return build_site_summaries(devices)

    def site_results(self, site: int) -> list[dict[str, Any]]:
        with self.lock:
            return [
                entry.model_dump(by_alias=True)
                for entry in self.devices
                if entry.device.site == site
            ]

    def wafer_map(self, lot: str, wafer: str) -> dict[str, Any] | None:
        with self.lock:
            matches = [
                entry for entry in self.devices
                if entry.device.lot == lot and entry.device.wafer == wafer
            ]
            radius = self.wafer_radius
        if not matches:
            return None
        return {
            "lot": lot,
            "wafer": wafer,
            "radius": radius,
            "points": [
                {
                    "pid": entry.device.pid,
                    "x": entry.device.x,
                    "y": entry.device.y,
                    "pf": entry.device.pf,
                    "softBin": entry.device.softBin,
                    "site": entry.device.site,
                }
                for entry in matches
            ],
        }

    def lots(self) -> list[dict[str, Any]]:
        with self.lock:
            devices = [entry.model_copy(deep=True) for entry in self.devices]
        groups: dict[str, list[DeviceTestResult]] = defaultdict(list)
        for entry in devices:
            groups[entry.device.lot].append(entry)
        return [lot_list_item(lot, entries) for lot, entries in sorted(groups.items(), reverse=True)]

    def lot_summary(self, lot: str) -> dict[str, Any] | None:
        with self.lock:
            entries = [
                entry.model_copy(deep=True)
                for entry in self.devices
                if entry.device.lot == lot
            ]
        if not entries:
            return None
        wafers: dict[str, list[DeviceTestResult]] = defaultdict(list)
        for entry in entries:
            wafers[entry.device.wafer].append(entry)
        total = len(entries)
        pass_rate = sum(entry.device.pf == "PASS" for entry in entries) / total
        # Soft bin 有真實對照表（bin_label()），hard bin 目前沒有——demo 資料
        # 裡 hardBin 只是 softBin 的複製，真實的 hard bin 分類要工程師另外提供。
        soft_bins = bin_breakdown(entries, "softBin", label_fn=bin_label)
        hard_bins = bin_breakdown(entries, "hardBin")
        wafer_items = [wafer_list_item(name, values) for name, values in sorted(wafers.items())]
        issues = [
            f"Wafer {item['wafer']}: {item['status']}"
            for item in wafer_items if item["hasIssue"]
        ]
        return {
            "lot": lot,
            "waferCount": len(wafers),
            "totalDevices": total,
            "passRate": pass_rate,
            "siteSummaries": build_site_summaries(entries),
            "softBinBreakdown": soft_bins,
            "hardBinBreakdown": hard_bins,
            "suspectIssues": issues,
            "wafers": wafer_items,
        }

    def trends(self, lot: str | None = None, wafer: str | None = None, site: int | None = None) -> list[dict[str, Any]]:
        with self.lock:
            entries = [
                entry
                for entry in self.devices
                if (lot is None or entry.device.lot == lot)
                and (wafer is None or entry.device.wafer == wafer)
                and (site is None or entry.device.site == site)
            ]
        # 每條趨勢只能對應一個實際測項；不能把不同單位/量級的測項平均成 ALL。
        by_test: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
        for entry in entries:
            for result in entry.results:
                if result.value is None or sensor_index(result) is not None:
                    continue
                test_name = event_id(result.testNumber, result.testSuiteName, result.pinName)
                by_test[(entry.device.site, test_name)].append({
                    "timestamp": entry.device.testTime,
                    "wafer": entry.device.wafer,
                    "pid": entry.device.pid,
                    "value": result.value,
                })

        series = []
        for (site, test_name), points in sorted(by_test.items()):
            points.sort(key=lambda point: (point["timestamp"], point["pid"]))
            for sequence, point in enumerate(points, start=1):
                point["sequence"] = sequence
            baseline = [point["value"] for point in points[:TREND_BASELINE_POINTS]]
            baseline_mean = mean(baseline)
            baseline_std_dev = sample_std_dev(baseline)
            alerts = detect_trend_alerts(site, test_name, points, baseline_mean, baseline_std_dev)
            series.append({
                "site": site,
                "testSuiteName": test_name,
                "points": points,
                "baselineMean": baseline_mean,
                "baselineStdDev": baseline_std_dev,
                "ucl": baseline_mean + 3 * baseline_std_dev,
                "lcl": baseline_mean - 3 * baseline_std_dev,
                "alerts": alerts,
            })
        return series

    def failure_explanations(self, limit: int) -> list[dict[str, Any]]:
        with self.lock:
            failed = [entry.model_copy(deep=True) for entry in self.devices if entry.device.pf == "FAIL"]
        explanations = []
        for entry in failed[-limit:][::-1]:
            result = next((result for result in entry.results if result.value is not None and sensor_index(result) is None), None)
            if result is None:
                continue
            value = result.value or 0.0
            reasons = []
            if result.highLimit is not None and value > result.highLimit:
                reasons.append(
                    f"實際值 {value:.3f} 超過上限 {result.highLimit:.3f}，因此判定為測試失敗"
                )
            if result.lowLimit is not None and value < result.lowLimit:
                reasons.append(
                    f"實際值 {value:.3f} 低於下限 {result.lowLimit:.3f}，因此判定為測試失敗"
                )
            if not reasons:
                reasons.append(
                    f"測試結果判定為 Fail；Soft Bin {entry.device.softBin}"
                    f"（{bin_label(entry.device.softBin)}）"
                )
            explanations.append({
                "pid": entry.device.pid,
                "site": entry.device.site,
                "testSuiteName": result.testSuiteName,
                "value": value,
                "softBin": entry.device.softBin,
                "binLabel": bin_label(entry.device.softBin),
                "summary": reasons[0],
                "reasons": reasons,
            })
        return explanations

    def wafer_fails(self, lot: str, wafer: str) -> dict[str, Any] | None:
        """Only FAIL data: one row per (failing device, failing event)."""
        with self.lock:
            entries = [
                entry.model_copy(deep=True)
                for entry in self.devices
                if entry.device.lot == lot and entry.device.wafer == wafer
                and (entry.device.pf == "FAIL" or entry.failEvents)
            ]
            any_device = any(e.device.lot == lot and e.device.wafer == wafer for e in self.devices)
        if not any_device:
            return None
        rows: list[dict[str, Any]] = []
        for entry in entries:
            base = {
                "pid": entry.device.pid,
                "site": entry.device.site,
                "x": entry.device.x,
                "y": entry.device.y,
                "softBin": entry.device.softBin,
                "softBinLabel": bin_label(entry.device.softBin),
                "hardBin": entry.device.hardBin,
                "hardBinLabel": hard_bin_label(entry.device.hardBin),
            }
            if entry.failEvents:
                for fe in entry.failEvents:
                    rows.append({**base, "event": fe.event, "meaning": fe.meaning, "value": fe.value,
                                 "lowLimit": fe.lowLimit, "highLimit": fe.highLimit})
            else:  # 只有 bin 判定失敗、沒有對應的超標測項事件
                rows.append({**base, "event": None, "meaning": None, "value": None,
                             "lowLimit": None, "highLimit": None})
        counts: dict[str, dict[str, Any]] = {}
        for row in rows:
            if row["event"]:
                item = counts.setdefault(row["event"], {"event": row["event"], "meaning": row["meaning"], "count": 0})
                item["count"] += 1
        return {"lot": lot, "wafer": wafer, "events": sorted(counts.values(), key=lambda e: e["event"]), "rows": rows}

    def wafer_distribution(self, lot: str, wafer: str, selected_event: str | None = None) -> dict[str, Any] | None:
        """Return all numeric measurements for one event on one wafer.

        Unlike ``wafer_fails()``, this intentionally includes PASS and FAIL
        values so the frontend can draw an unbiased empirical CDF.
        """
        with self.lock:
            entries = [
                entry.model_copy(deep=True)
                for entry in self.devices
                if entry.device.lot == lot and entry.device.wafer == wafer
            ]
        if not entries:
            return None

        grouped: dict[str, dict[str, Any]] = {}
        for entry in entries:
            for result in entry.results:
                if result.value is None:
                    continue
                key = event_id(result.testNumber, result.testSuiteName, result.pinName)
                item = grouped.setdefault(key, {
                    "event": key,
                    "testSuiteName": result.testSuiteName,
                    "pinName": result.pinName,
                    "unit": result.unit,
                    "lowLimit": result.lowLimit,
                    "highLimit": result.highLimit,
                    "samples": [],
                })
                item["samples"].append({
                    "pid": entry.device.pid,
                    "site": entry.device.site,
                    "value": result.value,
                    "pass": result.pass_,
                })

        events = [
            {key: value for key, value in item.items() if key != "samples"} | {"count": len(item["samples"])}
            for item in sorted(grouped.values(), key=lambda item: item["event"])
        ]
        if not events:
            return {"lot": lot, "wafer": wafer, "events": [], "selectedEvent": None, "samples": []}

        key = selected_event if selected_event in grouped else events[0]["event"]
        item = grouped[key]
        values = sorted(sample["value"] for sample in item["samples"])
        n = len(values)
        samples = [
            {**sample, "probability": (index + 0.5) / n}
            for index, sample in enumerate(sorted(item["samples"], key=lambda sample: sample["value"]))
        ]
        return {
            "lot": lot,
            "wafer": wafer,
            "events": events,
            "selectedEvent": key,
            "unit": item["unit"],
            "lowLimit": item["lowLimit"],
            "highLimit": item["highLimit"],
            "samples": samples,
        }

    def set_thermal_progress(self, completed: int) -> None:
        with self.lock:
            self.thermal_completed[(self.lot, self.wafer)] = completed

    def thermal_wafer(self, lot: str, wafer: str) -> dict[str, Any] | None:
        with self.lock:
            entries = [
                entry.model_copy(deep=True)
                for entry in self.devices
                if entry.device.lot == lot
            ]
            is_live = lot == self.lot and wafer == self.wafer
            completed = self.thermal_completed.get((lot, wafer), 0) if is_live else None
        return build_wafer_thermal(entries, lot, wafer, is_live, completed, now_iso())

    def predict_next_sensor(self, request) -> dict[str, Any] | None:
        """Predict one new-wafer device using the complete W01-W25 corpus.

        The request contains only results already measured before the next
        sensor. No result from the incoming wafer is added to the training
        set, so this is the same contract the tester/container integration
        will use in production.
        """
        with self.lock:
            training_entries = [
                entry.model_copy(deep=True)
                for entry in self.devices
                if entry.device.lot == request.lot
            ]
        if not training_entries:
            return None

        sensor_fields: dict[int, TestResultField] = {}
        for entry in training_entries:
            for field in entry.results:
                index = sensor_index(field)
                if index is not None:
                    sensor_fields.setdefault(index, field)
        sensor_ids = sorted(sensor_fields)
        if request.completedSensors >= len(sensor_ids):
            return None
        target_sensor = sensor_ids[request.completedSensors]
        incoming = DeviceTestResult(device=request.device, results=request.results)
        prediction = fit_cross_wafer_predictor(training_entries, [], target_sensor, target_entry=incoming)
        predicted = None if not len(prediction) or np.isnan(prediction[0]) else float(prediction[0])
        target_field = sensor_fields[target_sensor]
        bounds = [value for value in (target_field.highLimit, target_field.lowLimit) if value is not None]
        upper = max(bounds) if bounds else None
        status = classify(predicted, upper)
        display_name = sensor_label(target_field)
        return {
            "lot": request.lot,
            "wafer": request.wafer,
            "device": request.device.pid,
            "site": request.device.site,
            "sensor": target_sensor,
            "testName": display_name,
            "predicted": predicted,
            "upperLimit": upper,
            "unit": target_field.unit or DEFAULT_UNIT,
            "status": status,
            "trainingWafers": sorted({entry.device.wafer for entry in training_entries}),
            "message": (
                f"{display_name} 預測值 {predicted:.2f}{target_field.unit or DEFAULT_UNIT}，"
                f"規格上限 {upper:g}{target_field.unit or DEFAULT_UNIT}，判定為 {status}"
                if predicted is not None and upper is not None
                else "目前資料不足，無法預測下一個 sensor"
            ),
        }

    def temperature_snapshot(self) -> dict[str, Any]:
        """A neutral transport contract until the ML team supplies predictions.

        Do not derive temperatures from unrelated parametric values here.  The
        model worker will record real predictions and tester notifications.
        """
        return {"generatedAt": now_iso(), "predictions": [], "notifications": []}


# Trend-alert thresholds. These intentionally mirror the constants in
# frontend/src/lib/api/mock.ts (TREND_CONSECUTIVE_RUN, TREND_SHIFT_RUN, and
# the 1.6 / 0.62 stdev-ratio cutoffs) so the mock fallback and the real
# backend produce alerts with the same semantics once this endpoint is fully
# wired up. There is no shared config between the Python and TypeScript
# codebases, so if one side's thresholds change, update the other by hand.
TREND_CONSECUTIVE_RUN = 6  # 連續 N 點單邊上升/下降算 trend
TREND_SHIFT_RUN = 8  # 連續 N 點落在 baseline mean 同一側算 shift
TREND_STDEV_RATIO_UP = 1.6
TREND_STDEV_RATIO_DOWN = 0.62
TREND_BASELINE_POINTS = 10
TREND_MIN_POINTS = 18


def longest_run(values: list[float], direction: str) -> int:
    if not values:
        return 0
    longest = 1
    current = 1
    for i in range(1, len(values)):
        rising = values[i] > values[i - 1]
        falling = values[i] < values[i - 1]
        matches = rising if direction == "up" else falling
        if matches:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def sample_std_dev(values: list[float]) -> float:
    """Sample standard deviation for control limits (n-1 denominator)."""
    if len(values) < 2:
        return 0.0
    average = mean(values)
    return sqrt(sum((value - average) ** 2 for value in values) / (len(values) - 1))


def detect_trend_alerts(
    site: int,
    test_name: str,
    points: list[dict[str, Any]],
    baseline_mean: float,
    baseline_std_dev: float,
) -> list[dict[str, Any]]:
    """Apply control-chart rules to one Site and one real test item.

    The caller has already separated test items and ordered points by test
    timestamp. This function deliberately does not compare unlike tests or
    treat the first ten points as a production-wide reference population.
    """
    values = [point["value"] for point in points]
    if len(values) < TREND_MIN_POINTS:
        return []

    alerts: list[dict[str, Any]] = []
    ucl = baseline_mean + 3 * baseline_std_dev
    lcl = baseline_mean - 3 * baseline_std_dev

    out_of_control = any(v > ucl or v < lcl for v in values)
    if out_of_control:
        alerts.append({
            "id": f"trend-{site}-{test_name}-ooc",
            "site": site,
            "testSuiteName": test_name,
            "direction": "SHIFT",
            "detectedAt": now_iso(),
            "message": f"{test_name}：量測值超出管制界線（UCL {ucl:.3f} / LCL {lcl:.3f}）",
        })

    rising_run = longest_run(values, "up")
    falling_run = longest_run(values, "down")
    if rising_run >= TREND_CONSECUTIVE_RUN:
        alerts.append({
            "id": f"trend-{site}-{test_name}-up",
            "site": site,
            "testSuiteName": test_name,
            "direction": "UP",
            "detectedAt": now_iso(),
            "message": f"{test_name}：連續 {rising_run} 個 Device 量測值持續上升，疑似製程漂移",
        })
    elif falling_run >= TREND_CONSECUTIVE_RUN:
        alerts.append({
            "id": f"trend-{site}-{test_name}-down",
            "site": site,
            "testSuiteName": test_name,
            "direction": "DOWN",
            "detectedAt": now_iso(),
            "message": f"{test_name}：連續 {falling_run} 個 Device 量測值持續下降，疑似製程漂移",
        })

    half = len(values) // 2
    first_half_std = std_dev(values[:half])
    second_half_std = std_dev(values[half:])
    std_ratio = second_half_std / max(first_half_std, 1e-6)
    if std_ratio > TREND_STDEV_RATIO_UP:
        alerts.append({
            "id": f"trend-{site}-{test_name}-std-up",
            "site": site,
            "testSuiteName": test_name,
            "direction": "SHIFT",
            "detectedAt": now_iso(),
            "message": (
                f"{test_name}：後半段標準差（{second_half_std:.3f}）是前半段"
                f"（{first_half_std:.3f}）的 {std_ratio:.1f} 倍，疑似製程穩定性下降"
            ),
        })
    elif std_ratio < TREND_STDEV_RATIO_DOWN:
        alerts.append({
            "id": f"trend-{site}-{test_name}-std-down",
            "site": site,
            "testSuiteName": test_name,
            "direction": "SHIFT",
            "detectedAt": now_iso(),
            "message": (
                f"{test_name}：後半段標準差（{second_half_std:.3f}）明顯小於前半段"
                f"（{first_half_std:.3f}），製程波動收斂"
            ),
        })

    last_run = values[-TREND_SHIFT_RUN:]
    if len(last_run) == TREND_SHIFT_RUN and not out_of_control:
        all_above = all(v > baseline_mean for v in last_run)
        all_below = all(v < baseline_mean for v in last_run)
        if all_above or all_below:
            alerts.append({
                "id": f"trend-{site}-{test_name}-shift",
                "site": site,
                "testSuiteName": test_name,
                "direction": "SHIFT",
                "detectedAt": now_iso(),
                "message": (
                    f"{test_name}：最近 {TREND_SHIFT_RUN} 個 Device 量測值全部"
                    f"落在 baseline 平均值（{baseline_mean:.3f}）同一側，疑似製程平均位移"
                ),
            })

    return alerts


def measurement_to_result(measurement: Measurement) -> TestResultField:
    return TestResultField.model_validate({
        "testNumber": measurement.testNumber,
        "testSuiteName": measurement.testSuiteName,
        "pinName": measurement.pinName,
        "kind": measurement.kind,
        "value": measurement.value,
        "unit": measurement.unit,
        "lowLimit": measurement.lowLimit,
        "highLimit": measurement.highLimit,
        "pass": measurement.passed,
    })


def measurement_values(entries: list[DeviceTestResult]) -> list[float]:
    # sensor 測項（場景二的預測目標，數值範圍跟 IDDQ 完全不同）不能混進
    # Site imbalance / 趨勢的平均值裡，否則 mean 會被拉到毫無意義的數字。
    return [
        result.value
        for entry in entries
        for result in entry.results
        if result.value is not None and sensor_index(result) is None
    ]


def build_site_summaries(entries: list[DeviceTestResult]) -> list[dict[str, Any]]:
    by_site: dict[int, list[DeviceTestResult]] = defaultdict(list)
    for entry in entries:
        by_site[entry.device.site].append(entry)

    site_values: dict[int, list[float]] = {}
    site_means: dict[int, float] = {}
    for site, site_entries in by_site.items():
        values = measurement_values(site_entries)
        site_values[site] = values
        site_means[site] = mean(values)

    # --- Site Imbalance detection -------------------------------------------------
    #
    # The previous rule flagged a site anomalous when its mean deviated from the
    # POOLED mean of every raw measurement by more than 3 * stdDev(all raw
    # measurements). That statistic is self-defeating: the very site that is
    # shifted also inflates the pooled stdDev it is being measured against. With
    # a shift of +8.5mA / stdDev 1.8 on one site against a 19.5mA / stdDev 0.3
    # baseline on the other three (the frontend's own demo numbers, see
    # frontend/src/lib/api/mock.ts), the pooled stdDev balloons to ~3.8, pushing
    # the 3-sigma threshold to ~11.4 mA — comfortably ABOVE the actual 6.4mA
    # deviation, so the genuinely bad site would never trip this rule.
    #
    # The fix compares SITE MEANS to each other, not to the pooled raw values,
    # using median + MAD (median absolute deviation) instead of mean + stdDev:
    # median/MAD is a robust statistic that resists exactly the "the outlier
    # pollutes its own reference distribution" problem above, because a single
    # outlier among only 3-4 site means barely moves the median (unlike the
    # mean) or the MAD (unlike stdDev). This mirrors the ANOVA-style "compare
    # against peers" approach from the 總架構 planning doc, without needing a
    # stats dependency (scipy) for F-distribution p-values.
    #
    # Caveat: with only 3-4 sites this is an inherently small-sample statistic —
    # it works well for "one clearly bad site among several normal ones" (the
    # case that matters for this hackathon) but degrades if two or more sites
    # are simultaneously bad, or if there are only 2 sites (MAD undefined).
    means_list = list(site_means.values())
    robust_center = median(means_list) if len(means_list) >= 3 else mean(means_list)
    mad = median([abs(m - robust_center) for m in means_list]) if len(means_list) >= 3 else 0.0
    # 1.4826 is the standard scale factor that makes MAD comparable to stdDev
    # under a normal-distribution assumption.
    scaled_mad = max(mad * 1.4826, 1e-6)

    summaries = []
    for site in sorted(by_site):
        site_entries = by_site[site]
        values = site_values[site]
        site_mean = site_means[site]
        deviation = abs(site_mean - robust_center)
        anomalous = len(values) >= 5 and len(means_list) >= 3 and deviation > 3 * scaled_mad
        summaries.append({
            "site": site,
            "count": len(site_entries),
            "passRate": sum(entry.device.pf == "PASS" for entry in site_entries) / len(site_entries),
            "failDeviceCount": sum(entry.device.pf == "FAIL" for entry in site_entries),
            "mean": site_mean,
            "stdDev": std_dev(values),
            "isAnomalous": anomalous,
            "anomalyReason": (
                f"Site mean differs from the other sites' median by {deviation:.4f}"
                if anomalous else None
            ),
            "boxplot": five_number_summary(values),
        })
    return summaries


def build_snapshot(
    entries: list[DeviceTestResult],
    lot: str,
    wafer: str,
    anomaly_alerts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    pass_rate = sum(entry.device.pf == "PASS" for entry in entries) / len(entries) if entries else 0
    site_summaries = build_site_summaries(entries)
    site_alerts = [
        {
            "id": f"site-{summary['site']}-imbalance",
            "site": summary["site"],
            "testSuiteName": "ALL",
            "direction": "SHIFT",
            "detectedAt": now_iso(),
            "message": summary["anomalyReason"],
        }
        for summary in site_summaries if summary["isAnomalous"]
    ]
    rule_alerts = anomaly_alerts or []
    alerts = site_alerts + [
        {
            "id": f"{alert['wafer']}-{alert['type']}-{alert.get('testName') or 'wafer'}-{alert.get('site') or 'all'}",
            "site": alert.get("site") or 0,
            "testSuiteName": alert.get("testName") or "WAFER",
            "direction": "SHIFT",
            "detectedAt": now_iso(),
            "message": alert["message"],
        }
        for alert in rule_alerts
    ]
    return {
        "generatedAt": now_iso(),
        "currentLot": lot,
        "currentWafer": wafer,
        "totalDevicesTested": len(entries),
        "overallPassRate": pass_rate,
        "siteSummaries": site_summaries,
        "trendAlerts": alerts,
        "recentResults": [entry.model_dump(by_alias=True) for entry in entries[-15:][::-1]],
    }


def bin_breakdown(
    entries: list[DeviceTestResult],
    field_name: str,
    label_fn: Callable[[int], str] | None = None,
) -> list[dict[str, Any]]:
    counts = Counter(getattr(entry.device, field_name) for entry in entries)
    total = len(entries)
    label = label_fn or (lambda bin_number: f"Bin {bin_number}")
    return [
        {"bin": bin_number, "label": label(bin_number), "count": count, "ratio": count / total}
        for bin_number, count in counts.most_common()
    ]


_MOCK_WAFER_ACCEPTANCE_STATUS: dict[str, tuple[str, str]] = {
    "W01": ("SITE_UNBALANCE", "Site 之間的量測分布不一致"),
    "W03": ("LOW_YIELD", "Wafer 良率低於 80%"),
    "W09": ("LOW_YIELD", "Wafer 良率低於 80%"),
    "W14": ("MEAN_TREND_UP", "Touchdown 平均值持續上升"),
    "W18": ("MEAN_TREND_DOWN", "Touchdown 平均值持續下降"),
    "W23": ("STDEV_TREND_UP", "Touchdown 波動逐漸變大"),
    "W25": ("STDEV_TREND_DOWN", "Touchdown 波動逐漸變小且偏離基準"),
}


def wafer_list_item(wafer: str, entries: list[DeviceTestResult]) -> dict[str, Any]:
    pass_rate = sum(entry.device.pf == "PASS" for entry in entries) / len(entries)
    status, reason = _MOCK_WAFER_ACCEPTANCE_STATUS.get(wafer, ("NORMAL", "符合目前 wafer-level 驗收規則"))
    return {
        "wafer": wafer,
        "totalDevices": len(entries),
        "passRate": pass_rate,
        "status": status,
        "statusReason": reason,
        "hasIssue": status != "NORMAL",
    }


def lot_list_item(lot: str, entries: list[DeviceTestResult]) -> dict[str, Any]:
    wafers = {entry.device.wafer for entry in entries}
    pass_rate = sum(entry.device.pf == "PASS" for entry in entries) / len(entries)
    started_at = min((entry.device.testTime for entry in entries), default=now_iso())
    return {
        "lot": lot,
        "waferCount": len(wafers),
        "totalDevices": len(entries),
        "passRate": pass_rate,
        "hasIssue": pass_rate < 0.8,
        "startedAt": started_at,
    }


runtime_state = RuntimeState()
