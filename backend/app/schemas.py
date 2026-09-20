from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PassFail = Literal["PASS", "FAIL"]
TestKind = Literal["FUNCTIONAL", "PARAMETRIC", "MULTI_PARAM", "SCAN"]


class DeviceInfo(BaseModel):
    pid: str
    lot: str
    wafer: str
    site: int = Field(ge=1)
    x: int
    y: int
    pf: PassFail
    softBin: int
    hardBin: int
    testTime: str


class TestResultField(BaseModel):
    testNumber: int
    testSuiteName: str
    pinName: str | None = None
    kind: TestKind
    value: float | None = None
    unit: str | None = None
    lowLimit: float | None = None
    highLimit: float | None = None
    pass_: bool = Field(alias="pass")

    model_config = {"populate_by_name": True}


class FailEvent(BaseModel):
    """One failing test event (out-of-limit measurement) of one device."""

    event: str  # 如 220_Main.Suite1#CP
    testNumber: int
    testSuiteName: str
    pinName: str | None = None
    value: float
    lowLimit: float | None = None
    highLimit: float | None = None
    meaning: str | None = None


class DeviceTestResult(BaseModel):
    device: DeviceInfo
    results: list[TestResultField] = Field(default_factory=list)
    failEvents: list[FailEvent] = Field(default_factory=list)


class Measurement(BaseModel):
    site: int = Field(ge=1)
    testNumber: int
    testSuiteName: str
    pinName: str | None = None
    kind: TestKind = "MULTI_PARAM"
    value: float | None = None
    unit: str | None = None
    lowLimit: float | None = None
    highLimit: float | None = None
    passed: bool = True


class LotStart(BaseModel):
    lot: str


class WaferStart(BaseModel):
    wafer: str
    radius: int = Field(default=20, gt=0)


class ThermalPredictRequest(BaseModel):
    """Prefix results sent by the tester before the next sensor starts."""

    lot: str
    wafer: str
    device: DeviceInfo
    results: list[TestResultField] = Field(default_factory=list)
    completedSensors: int = Field(default=0, ge=0, le=6)
