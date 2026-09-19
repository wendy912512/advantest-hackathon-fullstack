from __future__ import annotations

import csv
import re
import statistics
from pathlib import Path

from .models import Measurement


def read_training_csv(
    path: str | Path,
    tester_id: str = "testerA",
    test_names: set[str] | None = None,
) -> list[Measurement]:
    """將訓練 CSV 的每個 device/test cell 轉成共用 Measurement。

    真實 ONEAPI 事件會走 event_parser；兩條路徑只在這裡匯合，避免離線測試
    反過來污染即時事件解析。
    """
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.reader(source))
    if len(rows) < 6:
        raise ValueError(f"CSV rows are incomplete: {path}")
    header, pin_row, test_num_row, high_row, low_row = rows[:5]
    header = rows[0]
    data_rows = rows[5:]
    measurements: list[Measurement] = []
    for touchdown_index, row in enumerate(data_rows):
        if len(row) < len(header):
            continue
        lot_id, wafer_id = row[1], row[2]
        site = int(row[3])
        x = float(row[4]) if row[4] else None
        y = float(row[5]) if row[5] else None
        soft_bin = int(row[7]) if row[7] else None
        hard_bin = int(row[8]) if row[8] else None
        for column in range(10, len(header)):
            if test_names is not None and header[column] not in test_names:
                continue
            try:
                value = float(row[column])
            except (ValueError, IndexError):
                continue
            high_limit = _number_or_none(high_row[column])
            low_limit = _number_or_none(low_row[column])
            # Training CSV metadata is named high/low but the supplied fixture has
            # the two numeric fields reversed. Normalize to mathematical low/high.
            limits = [item for item in (low_limit, high_limit) if item is not None]
            normalized_low = min(limits) if limits else None
            normalized_high = max(limits) if limits else None
            measurements.append(
                Measurement(
                    tester_id=tester_id,
                    lot_id=lot_id,
                    wafer_id=wafer_id,
                    site=site,
                    test_name=header[column],
                    value=value,
                    unit=pin_row[column] or None,
                    low_limit=normalized_low,
                    high_limit=normalized_high,
                    touchdown_index=touchdown_index,
                    x=x,
                    y=y,
                    soft_bin=soft_bin,
                    hard_bin=hard_bin,
                )
            )
    return measurements


def read_training_profile(path: str | Path, tester_id: str = "testerA") -> list[Measurement]:
    """Read only the two wafer-level series needed by offline trend validation.

    The RawResult fixture is very wide (about 3,000 tests x 80 devices). The
    real-time path keeps individual measurements, but offline label validation
    should not allocate one Python object per cell just to calculate a row mean
    and row standard deviation.
    """
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as source:
        rows = list(csv.reader(source))
    if len(rows) < 6:
        raise ValueError(f"CSV rows are incomplete: {path}")
    header = rows[0]
    data_rows = rows[5:]
    measurements: list[Measurement] = []
    for touchdown_index, row in enumerate(data_rows):
        numeric = []
        for value in row[10:]:
            try:
                numeric.append(float(value))
            except (TypeError, ValueError):
                continue
        if not numeric:
            continue
        common = {
            "tester_id": tester_id,
            "lot_id": row[1],
            "wafer_id": row[2],
            "site": int(row[3]),
            "touchdown_index": touchdown_index,
            "soft_bin": int(row[7]) if row[7] else None,
            "hard_bin": int(row[8]) if row[8] else None,
        }
        measurements.append(Measurement(
            **common,
            test_name="__ROW_MEAN__",
            value=statistics.fmean(numeric),
            metadata={"aggregate_series": "mean"},
        ))
    groups: dict[str, list[int]] = {}
    for column in range(10, len(header)):
        match = re.match(r"\d+_(Main\.subflow\d+)", header[column])
        if match:
            groups.setdefault(match.group(1), []).append(column)
    for group, columns in groups.items():
        for sequence_index, column in enumerate(columns):
            column_values = []
            for row in data_rows:
                try:
                    column_values.append(float(row[column]))
                except (TypeError, ValueError):
                    continue
            if len(column_values) < 8:
                continue
            first = data_rows[0]
            common_profile = {
                "tester_id": tester_id,
                "lot_id": first[1],
                "wafer_id": first[2],
                "site": 0,
                "touchdown_index": sequence_index,
            }
            measurements.append(Measurement(
                **common_profile,
                test_name=group,
                value=statistics.fmean(column_values),
                metadata={"profile_group": group, "aggregate_series": "mean"},
            ))
            measurements.append(Measurement(
                **common_profile,
                test_name=group,
                value=statistics.pstdev(column_values),
                metadata={"profile_group": group, "aggregate_series": "stdev"},
            ))
    return measurements


def _number_or_none(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
