from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class AnomalyType(StrEnum):
    OUT_OF_SPEC = "OUT_OF_SPEC"
    LOW_YIELD = "LOW_YIELD"
    SITE_UNBALANCE = "SITE_UNBALANCE"
    MEAN_TREND_UP = "MEAN_TREND_UP"
    MEAN_TREND_DOWN = "MEAN_TREND_DOWN"
    STDEV_TREND_UP = "STDEV_TREND_UP"
    STDEV_TREND_DOWN = "STDEV_TREND_DOWN"


@dataclass(frozen=True)
class Measurement:
    tester_id: str
    lot_id: str
    wafer_id: str
    site: int
    test_name: str
    value: float
    unit: str | None = None
    low_limit: float | None = None
    high_limit: float | None = None
    touchdown_index: int | None = None
    x: float | None = None
    y: float | None = None
    timestamp: datetime | None = None
    soft_bin: int | None = None
    hard_bin: int | None = None
    passed: bool | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Alert:
    anomaly_type: AnomalyType
    severity: str
    message: str
    tester_id: str
    lot_id: str
    wafer_id: str
    test_name: str | None = None
    site: int | None = None
    observed_value: float | None = None
    threshold: float | None = None
    evidence: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "type": self.anomaly_type.value,
            "severity": self.severity,
            "message": self.message,
            "testerId": self.tester_id,
            "lot": self.lot_id,
            "wafer": self.wafer_id,
            "testName": self.test_name,
            "site": self.site,
            "observedValue": self.observed_value,
            "threshold": self.threshold,
            "evidence": self.evidence,
        }


@dataclass
class WaferSummary:
    tester_id: str
    lot_id: str
    wafer_id: str
    alerts: list[Alert]
    measurements: int
    tested_devices: int
    pass_rate: float | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "testerId": self.tester_id,
            "lot": self.lot_id,
            "wafer": self.wafer_id,
            "measurements": self.measurements,
            "testedDevices": self.tested_devices,
            "passRate": self.pass_rate,
            "alerts": [alert.as_dict() for alert in self.alerts],
        }
