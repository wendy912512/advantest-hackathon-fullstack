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
    if value.strip().upper() in {"PASS", "P", "TRUE", "1", "Y", "YES"}:
        return "PASS"
    if value.strip().upper() in {"FAIL", "F", "FALSE", "0", "N", "NO"}:
        return "FAIL"
    return "PASS" if soft_bin == 1 else "FAIL"


def _test_kind(value: str) -> str:
    candidate = value.strip().upper().replace(" ", "_")
    if candidate in {"FUNCTIONAL", "PARAMETRIC", "MULTI_PARAM", "SCAN"}:
        return candidate
    return "MULTI_PARAM"


def _filename_lot(path: Path) -> str:
    return path.stem.split("_")[0] or "CSV-IMPORT"


def _filename_wafer(path: Path) -> str:
    match = re.search(r"(?:^|_)W(\d+)(?:_|$)", path.stem, flags=re.IGNORECASE)
    return f"W{match.group(1)}" if match else "CSV-WAFER"


def _read_rows(path: Path) -> list[dict[str, str]]:
    for encoding in ("utf-8-sig", "utf-8", "cp950"):
        try:
            with path.open("r", encoding=encoding, newline="") as file:
                reader = csv.DictReader(file)
                if not reader.fieldnames:
                    raise CsvImportError("CSV 缺少欄位標題列")
                return list(reader)
        except UnicodeDecodeError:
            continue
    raise CsvImportError("CSV 編碼無法讀取，請使用 UTF-8 或 Big5/CP950")


def import_csv(path_value: str, *, lot_override: str | None = None, wafer_override: str | None = None,
               reset: bool = True) -> dict[str, Any]:
    """Convert a CSV log into the same events used by the OneAPI callback path.

    The dataset column spelling is intentionally normalised (for example,
    ``PartId``, ``part_id`` and ``PID`` are treated as the same field).
    """

    path = Path(path_value).expanduser()
    if not path.is_file() or path.suffix.lower() != ".csv":
        raise CsvImportError("找不到 CSV 檔案，或檔案不是 .csv 格式")

    rows = _read_rows(path)
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

    device_count = 0
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
        device_count += 1
        result_count += len(results)

    return {
        "source": str(path),
        "lot": imported_lot,
        "rowsRead": len(rows),
        "devicesImported": device_count,
        "measurementsImported": result_count,
        "reset": reset,
    }
