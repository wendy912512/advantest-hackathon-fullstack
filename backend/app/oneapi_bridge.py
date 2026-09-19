"""HTTP bridge called from the official OneAPI ``SampleMonitor``.

``sample.py`` and FastAPI run as separate Python processes on ACS.  They cannot
share ``runtime_state`` directly, so this module serializes the callback data
and posts it to FastAPI's localhost-only internal endpoints.  It intentionally
uses only Python's standard library; the OneAPI runtime needs no extra package.
"""
from __future__ import annotations

import atexit
import json
import os
import queue
import sys
import threading
import urllib.error
import urllib.request
from typing import Any, Callable


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _passed(value: Any) -> bool:
    """Normalize OneAPI bool / integer / string pass-fail values."""
    if isinstance(value, str):
        return value.strip().upper() in {"1", "TRUE", "PASS", "P"}
    return bool(value)


class _EventPublisher:
    """Non-blocking, ordered delivery from the tester callback to FastAPI."""

    def __init__(self) -> None:
        self.base_url = os.getenv(
            "RTDI_API_BASE_URL", "http://127.0.0.1:8080/api/internal"
        ).rstrip("/")
        self.timeout = float(os.getenv("RTDI_API_TIMEOUT_SECONDS", "1.0"))
        self.events: queue.Queue[tuple[str, object] | None] = queue.Queue(maxsize=4000)
        self.worker = threading.Thread(target=self._run, daemon=True, name="rtdi-api")
        self.worker.start()

    def publish(self, endpoint: str, payload: object) -> None:
        try:
            self.events.put_nowait((endpoint, payload))
        except queue.Full:
            print("[RTDI] event queue full; dropping callback data", file=sys.stderr)

    def close(self) -> None:
        try:
            self.events.put_nowait(None)
        except queue.Full:
            return

    def _run(self) -> None:
        while True:
            event = self.events.get()
            if event is None:
                return
            endpoint, payload = event
            try:
                body = json.dumps(payload).encode("utf-8")
                request = urllib.request.Request(
                    f"{self.base_url}/{endpoint}",
                    data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=self.timeout):
                    pass
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
                # Never interrupt the tester's callback because the dashboard is down.
                print(f"[RTDI] delivery to {endpoint} failed: {error}", file=sys.stderr)
            finally:
                self.events.task_done()


class OneApiHttpBridge:
    """Translate the supplied OneAPI sample.py callback objects into API events."""

    def __init__(self) -> None:
        self.publisher = _EventPublisher()
        self.lot = "-"
        self.wafer = "-"
        atexit.register(self.publisher.close)

    def on_lot_start(self, data: Any) -> None:
        try:
            self.lot = str(data.get_LotId())
            self.publisher.publish("lot-start", {"lot": self.lot})
        except Exception as error:
            self._callback_error("LOTSTART", error)

    def on_wafer_start(self, data: Any) -> None:
        try:
            self.wafer = str(data.get_WaferId())
            wafer_size = _number(data.get_WaferSize())
            radius = max(1, _integer(wafer_size / 2 if wafer_size else 20, 20))
            self.publisher.publish("wafer-start", {"wafer": self.wafer, "radius": radius})
        except Exception as error:
            self._callback_error("WAFERSTART", error)

    def on_parametric(self, data: Any, to_site: Callable[[Any], int]) -> None:
        try:
            measurements = []
            for index in range(data.get_ResultCount()):
                measurements.append({
                    "site": _integer(to_site(data.query_HeadSite(index)), 1),
                    "testNumber": _integer(data.query_TestNumber(index)),
                    "testSuiteName": str(data.query_TestSuite(index)),
                    "pinName": str(data.query_MeasurementName(index)),
                    "kind": "PARAMETRIC",
                    "value": _number(data.query_Result(index)),
                    "unit": str(data.query_Unit(index)),
                    "lowLimit": _number(data.query_LowLimit(index)),
                    "highLimit": _number(data.query_HighLimit(index)),
                    "passed": _passed(data.query_TestFlag(index)),
                })
            if measurements:
                self.publisher.publish("measurements", measurements)
        except Exception as error:
            self._callback_error("PARAMETRIC", error)

    def on_multi_parametric(self, data: Any, to_site: Callable[[Any], int]) -> None:
        try:
            measurements = []
            for index in range(data.get_ResultCount()):
                values = data.query_Results(index)
                flags = data.query_PassFailList(index)
                site = _integer(to_site(data.query_HeadSite(index)), 1)
                for result_index, value in enumerate(values):
                    passed = _passed(flags[result_index]) if result_index < len(flags) else True
                    measurements.append({
                        "site": site,
                        "testNumber": _integer(data.query_TestNumber(index)),
                        "testSuiteName": str(data.query_TestSuite(index)),
                        "pinName": str(data.query_MeasurementName(index)),
                        "kind": "MULTI_PARAM",
                        "value": _number(value),
                        "unit": str(data.query_Unit(index)),
                        "lowLimit": _number(data.query_LowLimit(index)),
                        "highLimit": _number(data.query_HighLimit(index)),
                        "passed": passed,
                    })
            if measurements:
                self.publisher.publish("measurements", measurements)
        except Exception as error:
            self._callback_error("MULTI_PARAM", error)

    def on_test_end(self, data: Any, to_site: Callable[[Any], int]) -> None:
        try:
            for index in range(data.get_ResultCount()):
                soft_bin = _integer(data.query_SBinResult(index))
                self.publisher.publish("test-end", {
                    "device": {
                        "pid": str(data.query_PartId(index)),
                        "lot": self.lot,
                        "wafer": self.wafer,
                        "site": _integer(to_site(data.query_HeadSite(index)), 1),
                        "x": _integer(data.query_XCoord(index)),
                        "y": _integer(data.query_YCoord(index)),
                        "pf": "PASS" if soft_bin == 1 else "FAIL",
                        "softBin": soft_bin,
                        "hardBin": _integer(data.query_HBinResult(index)),
                        "testTime": str(data.query_TestTime(index)),
                    },
                    "results": [],
                })
        except Exception as error:
            self._callback_error("TESTEND", error)

    @staticmethod
    def _callback_error(event_name: str, error: Exception) -> None:
        print(f"[RTDI] {event_name} callback ignored: {error}", file=sys.stderr)
