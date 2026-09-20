"""Small, SDK-free bridge used from the official OneAPI ``SampleMonitor``.

Copy these method calls into the deployed ``sample.py`` after the team confirms
the event fields in its live py-app.log.  Keeping SDK imports out of this file
lets the FastAPI API run locally without an ACS installation.
"""
from __future__ import annotations

from .schemas import DeviceInfo, DeviceTestResult, Measurement, ThermalPredictRequest, TestResultField
from .state import runtime_state


def on_lot_start(data, state=runtime_state) -> None:
    state.start_lot(str(data.get_LotId()))


def on_wafer_start(data, state=runtime_state) -> None:
    state.start_wafer(str(data.get_WaferId()), int(data.get_WaferSize() / 2))


def on_multi_parametric(data, to_site, set_message=None, state=runtime_state) -> None:
    """Forward measured values and optionally notify the tester on OOS."""
    for index in range(data.get_ResultCount()):
        site = to_site(data.query_HeadSite(index))
        for value in data.query_Results(index):
            state.record_measurement(Measurement(
                site=site,
                testNumber=int(data.query_TestNumber(index)),
                testSuiteName=str(data.query_TestSuite(index)),
                kind="MULTI_PARAM",
                value=float(value),
                unit=str(data.query_Unit(index)),
                lowLimit=float(data.query_LowLimit(index)),
                highLimit=float(data.query_HighLimit(index)),
                passed=True,
            ), set_message=set_message)


def on_parametric(data, to_site, set_message=None, state=runtime_state) -> None:
    """Forward scalar parametric results using the SDK's singular getter."""
    for index in range(data.get_ResultCount()):
        site = to_site(data.query_HeadSite(index))
        value = data.query_Result(index)
        state.record_measurement(Measurement(
            site=site,
            testNumber=int(data.query_TestNumber(index)),
            testSuiteName=str(data.query_TestSuite(index)),
            kind="PARAMETRIC",
            value=float(value),
            unit=str(data.query_Unit(index)),
            lowLimit=float(data.query_LowLimit(index)),
            highLimit=float(data.query_HighLimit(index)),
            passed=True,
        ), set_message=set_message)


def on_test_end(data, to_site, state=runtime_state) -> None:
    for index in range(data.get_ResultCount()):
        soft_bin = int(data.query_SBinResult(index))
        state.record_test_end(DeviceTestResult(
            device=DeviceInfo(
                pid=str(data.query_PartId(index)),
                lot=state.lot,
                wafer=state.wafer,
                site=to_site(data.query_HeadSite(index)),
                x=int(data.query_XCoord(index)),
                y=int(data.query_YCoord(index)),
                pf="PASS" if soft_bin == 1 else "FAIL",
                softBin=soft_bin,
                hardBin=int(data.query_HBinResult(index)),
                testTime=str(data.query_TestTime(index)),
            )
        ))


def predict_before_sensor(
    data,
    to_site,
    completed_sensors: int,
    set_message=None,
    state=runtime_state,
) -> dict | None:
    """Call the cross-wafer model immediately before a sensor test starts.

    ``data`` is the tester-side prefix payload. The caller supplies the same
    already-measured fields that arrived before the sensor under prediction.
    If the result is Warning/Critical, ``set_message`` is invoked so the
    tester program can display the notification through ActionManager.
    """
    device = DeviceInfo(
        pid=str(data.query_PartId(0)),
        lot=state.lot,
        wafer=state.wafer,
        site=to_site(data.query_HeadSite(0)),
        x=int(data.query_XCoord(0)),
        y=int(data.query_YCoord(0)),
        pf="PASS",
        softBin=1,
        hardBin=1,
        testTime=str(data.query_TestTime(0)),
    )
    prefix_results = [
        TestResultField(
            testNumber=int(data.query_TestNumber(index)),
            testSuiteName=str(data.query_TestSuite(index)),
            pinName=None,
            kind="PARAMETRIC",
            value=float(data.query_Result(index)),
            unit=str(data.query_Unit(index)) or None,
            lowLimit=None,
            highLimit=None,
            **{"pass": True},
        )
        for index in range(data.get_ResultCount())
    ]
    result = state.predict_next_sensor(ThermalPredictRequest(
        lot=state.lot,
        wafer=state.wafer,
        device=device,
        results=prefix_results,
        completedSensors=completed_sensors,
    ))
    if result and result["status"] in {"warning", "critical"} and set_message is not None:
        set_message("testerA", result["message"])
    return result
