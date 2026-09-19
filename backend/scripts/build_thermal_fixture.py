"""Build frontend/src/lib/api/thermalFixture.json and failFixture.json from a real RawResult CSV.

The frontend mock fallback (used when the backend has no data) replays this
file, so the demo shows REAL sensor values and REAL leave-one-out predictions
instead of invented numbers.

    cd backend && .venv/bin/python scripts/build_thermal_fixture.py \
        ../frontend/reference/A12345_W01_RawResult.csv
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.csv_import import import_csv  # noqa: E402
from app.state import now_iso, runtime_state  # noqa: E402
from app.thermal import WARN_MARGIN, build_wafer_thermal  # noqa: E402

csv_path = sys.argv[1]
info = import_csv(csv_path, wafer_override="W01")
built = build_wafer_thermal(list(runtime_state.devices), info["lot"], "W01", False, None, now_iso())
fixture = {
    "sourceCsv": Path(csv_path).name,
    "warnMargin": WARN_MARGIN,
    "sensors": [{k: s[k] for k in ("index", "name", "testNumber", "upperLimit", "unit")} for s in built["sensors"]],
    "devices": [
        {
            "pid": d["pid"],
            "site": d["site"],
            "x": d["x"],
            "y": d["y"],
            "sensors": [
                {
                    "predicted": round(s["predicted"], 4) if s["predicted"] is not None else None,
                    "actual": round(s["actual"], 4) if s["actual"] is not None else None,
                }
                for s in d["sensors"]
            ],
        }
        for d in built["devices"]
    ],
}
out = Path(__file__).resolve().parent.parent.parent / "frontend/src/lib/api/thermalFixture.json"
out.write_text(json.dumps(fixture, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("wrote", out, len(fixture["devices"]), "devices")

fails = runtime_state.wafer_fails(info["lot"], "W01")
fail_out = out.parent / "failFixture.json"
fail_out.write_text(
    json.dumps({"sourceCsv": Path(csv_path).name, **fails}, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print("wrote", fail_out, len(fails["rows"]), "fail rows,", len(fails["events"]), "events")
