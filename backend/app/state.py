from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from math import sqrt
from threading import RLock
from typing import Any

from .alert_manager import AlertManager
from .anomaly_engine import AnomalyEngine
from .models import Measurement as AnomalyMeasurement
from .schemas import DeviceTestResult, Measurement, TestResultField


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def std_dev(values: list[float]) -> float:
    if not values:
        return 0.0
    average = mean(values)
    return sqrt(sum((value - average) ** 2 for value in values) / len(values))


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
    anomaly_engine: AnomalyEngine = field(default_factory=AnomalyEngine, repr=False)
    alert_manager: AlertManager = field(default_factory=AlertManager, repr=False)
    live_alerts: list[dict[str, Any]] = field(default_factory=list, repr=False)
    last_wafer_report: dict[str, Any] | None = field(default=None, repr=False)
    lock: RLock = field(default_factory=RLock, repr=False)

    def start_lot(self, lot: str) -> None:
        with self.lock:
            self.lot = lot
            self.wafer = "-"
            self.devices.clear()
            self.pending_measurements.clear()
            self.live_alerts.clear()
            self.last_wafer_report = None

    def start_wafer(self, wafer: str, radius: int = 20) -> None:
        with self.lock:
            self.wafer = wafer
            self.wafer_radius = radius

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
            self.pending_measurements[measurement.site].append(measurement)
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
            self.devices.append(result)
            self.lot = result.device.lot or self.lot
            self.wafer = result.device.wafer or self.wafer
            self.devices = self.devices[-2_000:]

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            devices = [entry.model_copy(deep=True) for entry in self.devices]
            lot = self.lot
            wafer = self.wafer
        return build_snapshot(devices, lot, wafer, self.anomaly_alerts())

    def anomaly_alerts(self) -> list[dict[str, Any]]:
        with self.lock:
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
        soft_bins = bin_breakdown(entries, "softBin")
        hard_bins = bin_breakdown(entries, "hardBin")
        wafer_items = [wafer_list_item(name, values) for name, values in sorted(wafers.items())]
        issues = [
            f"Wafer {item['wafer']} pass rate {item['passRate'] * 100:.1f}% is below 80%"
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

    def trends(self) -> list[dict[str, Any]]:
        with self.lock:
            entries = [entry.model_copy(deep=True) for entry in self.devices]
        by_site: dict[int, list[DeviceTestResult]] = defaultdict(list)
        for entry in entries:
            by_site[entry.device.site].append(entry)
        series = []
        for site, site_entries in sorted(by_site.items()):
            points = []
            for entry in site_entries:
                values = [result.value for result in entry.results if result.value is not None]
                if values:
                    points.append({"timestamp": entry.device.testTime, "value": mean(values)})
            baseline = [point["value"] for point in points[:10]]
            baseline_mean = mean(baseline)
            baseline_std_dev = std_dev(baseline)
            series.append({
                "site": site,
                "testSuiteName": "ALL",
                "points": points,
                "baselineMean": baseline_mean,
                "baselineStdDev": baseline_std_dev,
                "ucl": baseline_mean + 3 * baseline_std_dev,
                "lcl": baseline_mean - 3 * baseline_std_dev,
                "alerts": [],
            })
        return series

    def failure_explanations(self, limit: int) -> list[dict[str, Any]]:
        with self.lock:
            failed = [entry.model_copy(deep=True) for entry in self.devices if entry.device.pf == "FAIL"]
        explanations = []
        for entry in failed[-limit:][::-1]:
            result = next((result for result in entry.results if result.value is not None), None)
            if result is None:
                continue
            value = result.value or 0.0
            reasons = []
            if result.highLimit is not None and value > result.highLimit:
                reasons.append(f"Value {value:.4f} exceeds high limit {result.highLimit:.4f}")
            if result.lowLimit is not None and value < result.lowLimit:
                reasons.append(f"Value {value:.4f} is below low limit {result.lowLimit:.4f}")
            if not reasons:
                reasons.append(f"Soft bin {entry.device.softBin} reported a failure")
            explanations.append({
                "pid": entry.device.pid,
                "site": entry.device.site,
                "testSuiteName": result.testSuiteName,
                "value": value,
                "softBin": entry.device.softBin,
                "binLabel": f"Bin {entry.device.softBin}",
                "summary": reasons[0],
                "reasons": reasons,
            })
        return explanations

    def temperature_snapshot(self) -> dict[str, Any]:
        """A neutral transport contract until the ML team supplies predictions.

        Do not derive temperatures from unrelated parametric values here.  The
        model worker will record real predictions and tester notifications.
        """
        return {"generatedAt": now_iso(), "predictions": [], "notifications": []}


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
    return [
        result.value
        for entry in entries
        for result in entry.results
        if result.value is not None
    ]


def build_site_summaries(entries: list[DeviceTestResult]) -> list[dict[str, Any]]:
    by_site: dict[int, list[DeviceTestResult]] = defaultdict(list)
    for entry in entries:
        by_site[entry.device.site].append(entry)
    all_values = measurement_values(entries)
    overall_mean = mean(all_values)
    summaries = []
    for site, site_entries in sorted(by_site.items()):
        values = measurement_values(site_entries)
        site_mean = mean(values)
        deviation = abs(site_mean - overall_mean)
        anomalous = len(values) >= 5 and deviation > max(std_dev(all_values) * 3, 0.001)
        summaries.append({
            "site": site,
            "count": len(site_entries),
            "passRate": sum(entry.device.pf == "PASS" for entry in site_entries) / len(site_entries),
            "mean": site_mean,
            "stdDev": std_dev(values),
            "isAnomalous": anomalous,
            "anomalyReason": (
                f"Site mean differs from pooled mean by {deviation:.4f}"
                if anomalous else None
            ),
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


def bin_breakdown(entries: list[DeviceTestResult], field_name: str) -> list[dict[str, Any]]:
    counts = Counter(getattr(entry.device, field_name) for entry in entries)
    total = len(entries)
    return [
        {"bin": bin_number, "label": f"Bin {bin_number}", "count": count, "ratio": count / total}
        for bin_number, count in counts.most_common()
    ]


def wafer_list_item(wafer: str, entries: list[DeviceTestResult]) -> dict[str, Any]:
    pass_rate = sum(entry.device.pf == "PASS" for entry in entries) / len(entries)
    return {"wafer": wafer, "totalDevices": len(entries), "passRate": pass_rate, "hasIssue": pass_rate < 0.8}


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
