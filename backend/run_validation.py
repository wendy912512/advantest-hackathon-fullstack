from __future__ import annotations

import argparse
from pathlib import Path

from app.anomaly_engine import AnomalyEngine
from app.csv_adapter import read_training_profile


EXPECTED = {
    "W01": {"SITE_UNBALANCE"},
    "W03": {"LOW_YIELD"},
    "W09": {"LOW_YIELD"},
    "W14": {"MEAN_TREND_UP"},
    "W18": {"MEAN_TREND_DOWN"},
    "W23": {"STDEV_TREND_UP"},
    "W25": {"STDEV_TREND_DOWN"},
}

TARGET_TESTS = {
    "100_Main.sensor1#CP",
    "120_Main.sensor2#DS0",
    "140_Main.sensor3#IO4",
    "160_Main.sensor4#IO1",
    "180_Main.sensor5#IO2",
    "200_Main.sensor6#IO3",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate anomaly rules against the 25 labeled wafers.")
    parser.add_argument("--data-dir", type=Path, required=True)
    args = parser.parse_args()
    engine = AnomalyEngine()
    failed = False
    for path in sorted(args.data_dir.glob("*_RawResult.csv")):
        wafer = path.stem.split("_")[-2]
        result = engine.evaluate_wafer(read_training_profile(path))
        kinds = sorted({alert.anomaly_type.value for alert in result.alerts})
        expected = EXPECTED.get(wafer, set())
        found_expected = expected.intersection(kinds)
        is_normal = not expected
        passed = (not is_normal and bool(found_expected)) or (is_normal and not kinds)
        status = "PASS" if passed else "FAIL"
        print(f"{status} {wafer}: {', '.join(kinds) if kinds else 'NORMAL'}")
        if not passed:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
