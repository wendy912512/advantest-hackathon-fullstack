"""Fail-event helpers: event ids, meanings, and out-of-limit detection."""
from __future__ import annotations

import re

from .schemas import FailEvent, TestResultField

_SENSOR = re.compile(r"\.sensor(\d+)$")
_IDDQ = re.compile(r"\.IDDQ_flow\.(IDDQ_\w+)$")


def event_id(test_number: int, suite: str, pin: str | None) -> str:
    return f"{test_number}_{suite}#{pin}" if pin else f"{test_number}_{suite}"


def event_meaning(suite: str, pin: str | None) -> str | None:
    """Only events whose name carries an explicit meaning get one:
    ``sensorN`` (the temperature-sensor targets named in the official problem
    statement) and ``IDDQ_flow`` suites. Every other suite is just a generic
    ContiTest with no description anywhere, so it gets None and the UI shows
    no meaning rather than restating the id."""
    where = f"Pin {pin}" if pin else "Pin 未知"
    if m := _SENSOR.search(suite):
        return f"溫度 Sensor {m.group(1)} 測試（{where}）"
    if m := _IDDQ.search(suite):
        return f"IDDQ 測試 {m.group(1)}（{where}）"
    return None


def normalise_limits(low: float | None, high: float | None) -> tuple[float | None, float | None]:
    """保留資料來源的 Low Limit / High Limit 原始值，不重新排序。"""
    return low, high


def make_fail_event(
    test_number: int,
    suite: str,
    pin: str | None,
    value: float,
    low: float | None,
    high: float | None,
) -> FailEvent:
    return FailEvent(
        event=event_id(test_number, suite, pin),
        testNumber=test_number,
        testSuiteName=suite,
        pinName=pin,
        value=value,
        lowLimit=low,
        highLimit=high,
        meaning=event_meaning(suite, pin),
    )


def derive_fail_events(results: list[TestResultField]) -> list[FailEvent]:
    """Out-of-limit measurements (used by the ONEAPI path; CSV import computes
    its own over all ~3000 columns)."""
    events = []
    for r in results:
        if r.value is None or r.lowLimit is None or r.highLimit is None:
            continue
        if r.value < r.lowLimit or r.value > r.highLimit:
            events.append(make_fail_event(r.testNumber, r.testSuiteName, r.pinName, r.value, r.lowLimit, r.highLimit))
    return events
