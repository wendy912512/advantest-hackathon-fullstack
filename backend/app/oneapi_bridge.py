"""Small, SDK-free bridge used from the official OneAPI ``SampleMonitor``.

Copy these method calls into the deployed ``sample.py`` after the team confirms
the event fields in its live py-app.log.  Keeping SDK imports out of this file
lets the FastAPI API run locally without an ACS installation.
"""
from __future__ import annotations

from .schemas import DeviceInfo, DeviceTestResult, Measurement
from .state import runtime_state


def on_lot_start(data) -> None:
    runtime_state.start_lot(str(data.get_LotId()))


def on_wafer_start(data) -> None:
    runtime_state.start_wafer(str(data.get_WaferId()), int(data.get_WaferSize() / 2))


def on_multi_parametric(data, to_site) -> None:
    for index in range(data.get_ResultCount()):
        site = to_site(data.query_HeadSite(index))
        for value in data.query_Results(index):
            runtime_state.record_measurement(Measurement(
                site=site,
                testNumber=int(data.query_TestNumber(index)),
                testSuiteName=str(data.query_TestSuite(index)),
                kind="MULTI_PARAM",
                value=float(value),
                unit=str(data.query_Unit(index)),
                lowLimit=float(data.query_LowLimit(index)),
                highLimit=float(data.query_HighLimit(index)),
                passed=True,
            ))


def on_test_end(data, to_site) -> None:
    for index in range(data.get_ResultCount()):
        soft_bin = int(data.query_SBinResult(index))
        runtime_state.record_test_end(DeviceTestResult(
            device=DeviceInfo(
                pid=str(data.query_PartId(index)),
                lot=runtime_state.lot,
                wafer=runtime_state.wafer,
                site=to_site(data.query_HeadSite(index)),
                x=int(data.query_XCoord(index)),
                y=int(data.query_YCoord(index)),
                pf="PASS" if soft_bin == 1 else "FAIL",
                softBin=soft_bin,
                hardBin=int(data.query_HBinResult(index)),
                testTime=str(data.query_TestTime(index)),
            )
        ))
