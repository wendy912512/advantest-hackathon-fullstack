from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .schemas import DeviceInfo, DeviceTestResult, TestResultField
from .state import now_iso, runtime_state


class CsvImportError(ValueError):
    """Raised when a local CSV cannot be converted into dashboard events."""


def _normalise(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _lookup(row: dict[str, str], *aliases: str, default: str = "") -> str:
    normalised = {_normalise(key): value.strip() for key, value in row.items() if key}
    for alias in aliases:
        value = normalised.get(_normalise(alias))
        if value:
            return value
    return default


def _as_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _as_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_pass_fail(value: str, soft_bin: int) -> str:
    value = value.strip().upper()
    if value in {"PASS", "P", "TRUE", "1", "Y", "YES"}:
        return "PASS"
    if value in {"FAIL", "F", "FALSE", "N", "NO"}:
        return "FAIL"
    return "PASS" if soft_bin == 1 else "FAIL"


def _test_kind(value: str) -> str:
    candidate = value.strip().upper().replace(" ", "_")
    return candidate if candidate in {"FUNCTIONAL", "PARAMETRIC", "MULTI_PARAM", "SCAN"} else "MULTI_PARAM"


def _filename_lot(path: Path) -> str:
    return path.stem.split("_")[0] or "CSV-IMPORT"


def _filename_wafer(path: Path) -> str:
    match = re.search(r"(?:^|_)W(\d+)(?:_|$)", path.stem, flags=re.IGNORECASE)
    return f"W{match.group(1)}" if match else "CSV-WAFER"


def _read_table(path: Path) -> list[list[str]]:
    for encoding in ("utf-8-sig", "utf-8", "cp950"):
        try:
            with path.open("r", encoding=encoding, newline="") as file:
                table = list(csv.reader(file))
                if not table:
                    raise CsvImportError("CSV 缺少欄位標題列")
                return table
        except UnicodeDecodeError:
            continue
    raise CsvImportError("CSV 編碼無法讀取，請使用 UTF-8 或 Big5/CP950")


def _wide_test_name(column_name: str) -> str:
    return column_name.split("_", maxsplit=1)[-1].split("#", maxsplit=1)[0] or column_name


def _wide_test_number(column_name: str, metadata_value: str, fallback: int) -> int:
    number = _as_int(metadata_value, default=0)
    if number:
        return number
    match = re.match(r"(\d+)_", column_name)
    return int(match.group(1)) if match else fallback


def _import_wide_raw_result(
    table: list[list[str]],
    path: Path,
    *,
    lot_override: str | None,
    wafer_override: str | None,
    reset: bool,
    measurement_limit: int,
) -> dict[str, Any]:
    if len(table) < 6:
        raise CsvImportError("RawResult CSV 缺少測項描述列或 Device 資料列")

    header, pins, test_numbers, high_limits, low_limits, *device_rows = table
    if not device_rows:
        raise CsvImportError("RawResult CSV 沒有 Device 資料列")

    candidate_columns = [
        index
        for index in range(10, len(header))
        if any(_as_float(row[index] if index < len(row) else "") is not None for row in device_rows)
    ]
    selected_columns = candidate_columns[:measurement_limit]
    if not selected_columns:
        raise CsvImportError("RawResult CSV 找不到可用的數值測項")

    first = device_rows[0]
    imported_lot = lot_override or (first[1].strip() if len(first) > 1 else "") or _filename_lot(path)
    if reset:
        runtime_state.start_lot(imported_lot)

    result_count = 0
    for row_index, row in enumerate(device_rows, start=1):
        if len(row) < 10:
            continue
        soft_bin = _as_int(row[7] if len(row) > 7 else "", default=1)
        hard_bin = _as_int(row[8] if len(row) > 8 else "", default=soft_bin)
        pf = _as_pass_fail(row[6] if len(row) > 6 else "", soft_bin)
        results = []
        for fallback, column_index in enumerate(selected_columns, start=1):
            value = _as_float(row[column_index] if column_index < len(row) else "")
            if value is None:
                continue
            results.append(TestResultField(
                testNumber=_wide_test_number(
                    header[column_index],
                    test_numbers[column_index] if column_index < len(test_numbers) else "",
                    fallback,
                ),
                testSuiteName=_wide_test_name(header[column_index]),
                pinName=(pins[column_index] if column_index < len(pins) else "") or None,
                kind="PARAMETRIC",
                value=value,
                unit=None,
                lowLimit=_as_float(low_limits[column_index] if column_index < len(low_limits) else ""),
                highLimit=_as_float(high_limits[column_index] if column_index < len(high_limits) else ""),
                **{"pass": pf == "PASS"},
            ))
        runtime_state.record_test_end(DeviceTestResult(
            device=DeviceInfo(
                pid=(row[0].strip() if row else "") or f"row-{row_index}",
                lot=(row[1].strip() if len(row) > 1 else "") or imported_lot,
                wafer=wafer_override or (row[2].strip() if len(row) > 2 else "") or _filename_wafer(path),
                site=max(_as_int(row[3] if len(row) > 3 else "", default=1), 1),
                x=_as_int(row[4] if len(row) > 4 else ""),
                y=_as_int(row[5] if len(row) > 5 else ""),
                pf=pf,
                softBin=soft_bin,
                hardBin=hard_bin,
                testTime=(row[9].strip() if len(row) > 9 else "") or now_iso(),
            ),
            results=results,
        ))
        result_count += len(results)

    return {
        "source": str(path),
        "lot": imported_lot,
        "rowsRead": len(device_rows),
        "devicesImported": len(device_rows),
        "measurementsImported": result_count,
        "measurementLimit": measurement_limit,
        "reset": reset,
    }


def import_csv(
    path_value: str,
    *,
    lot_override: str | None = None,
    wafer_override: str | None = None,
    reset: bool = True,
    measurement_limit: int = 24,
) -> dict[str, Any]:
    """Convert a CSV log into the same events used by the OneAPI callback path."""

    path = Path(path_value).expanduser()
    if not path.is_file() or path.suffix.lower() != ".csv":
        raise CsvImportError("找不到 CSV 檔案，或檔案不是 .csv 格式")

    table = _read_table(path)
    if table[0][:10] == ["PID", "Lot", "Wafer", "Site", "X", "Y", "PF", "SBin", "HBin", "Test Time"]:
        return _import_wide_raw_result(
            table,
            path,
            lot_override=lot_override,
            wafer_override=wafer_override,
            reset=reset,
            measurement_limit=max(1, measurement_limit),
        )

    header, *raw_rows = table
    rows = [dict(zip(header, row)) for row in raw_rows]
    if not rows:
        raise CsvImportError("CSV 沒有資料列")

    grouped: dict[tuple[str, int, str, str, int, int], list[dict[str, str]]] = defaultdict(list)
    for row_index, row in enumerate(rows, start=1):
        pid = _lookup(row, "pid", "partid", "part_id", "deviceid", "device_id", default=f"row-{row_index}")
        site = _as_int(_lookup(row, "site", "headsite", "head_site"), default=1)
        wafer = wafer_override or _lookup(row, "wafer", "waferid", "wafer_id") or _filename_wafer(path)
        timestamp = _lookup(row, "testtime", "test_time", "timestamp", "time", default=now_iso())
        x = _as_int(_lookup(row, "x", "xcoord", "x_coord"))
        y = _as_int(_lookup(row, "y", "ycoord", "y_coord"))
        grouped[(pid, max(site, 1), wafer, timestamp, x, y)].append(row)

    imported_lot = lot_override or _lookup(rows[0], "lot", "lotid", "lot_id") or _filename_lot(path)
    if reset:
        runtime_state.start_lot(imported_lot)

    result_count = 0
    for (pid, site, wafer, timestamp, x, y), device_rows in grouped.items():
        first = device_rows[0]
        soft_bin = _as_int(_lookup(first, "softbin", "sbin", "sbinresult"), default=1)
        hard_bin = _as_int(_lookup(first, "hardbin", "hbin", "hbinresult"), default=soft_bin)
        pf = _as_pass_fail(_lookup(first, "pf", "passfail", "pass_fail", "result"), soft_bin)
        results = []
        for row_index, row in enumerate(device_rows, start=1):
            value = _as_float(_lookup(row, "value", "resultvalue", "result_value", "measuredvalue"))
            passed = _as_pass_fail(_lookup(row, "pass", "passed", "pf", "passfail"), soft_bin) == "PASS"
            results.append(TestResultField(
                testNumber=_as_int(_lookup(row, "testnumber", "test_number", "testnum"), default=row_index),
                testSuiteName=_lookup(row, "testsuitename", "testsuite", "test_suite", "testname", default="RawResult"),
                pinName=_lookup(row, "pinname", "pin_name", "pin") or None,
                kind=_test_kind(_lookup(row, "kind", "testkind", "test_type")),
                value=value,
                unit=_lookup(row, "unit") or None,
                lowLimit=_as_float(_lookup(row, "lowlimit", "low_limit", "lolimit")),
                highLimit=_as_float(_lookup(row, "highlimit", "high_limit", "hilimit")),
                **{"pass": passed},
            ))
        runtime_state.record_test_end(DeviceTestResult(
            device=DeviceInfo(
                pid=pid,
                lot=_lookup(first, "lot", "lotid", "lot_id", default=imported_lot),
                wafer=wafer,
                site=site,
                x=x,
                y=y,
                pf=pf,
                softBin=soft_bin,
                hardBin=hard_bin,
                testTime=timestamp,
            ),
            results=results,
        ))
        result_count += len(results)

    return {
        "source": str(path),
        "lot": imported_lot,
        "rowsRead": len(rows),
        "devicesImported": len(grouped),
        "measurementsImported": result_count,
        "measurementLimit": None,
        "reset": reset,
    }
