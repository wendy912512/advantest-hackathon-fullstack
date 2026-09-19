"""Build frontend fallback fixtures from RawResult CSV data.

When the API is temporarily unavailable, the frontend can replay these
CSV-derived values without inventing synthetic test results.

    cd backend && python scripts/build_thermal_fixture.py \
        ../training/Data/A12345_W01_RawResult.csv

For a directory, fail fixtures are generated for every matching wafer CSV:

    python scripts/build_thermal_fixture.py ../training/Data
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.csv_import import import_csv  # noqa: E402
from app.state import build_snapshot, now_iso, runtime_state  # noqa: E402
from app.thermal import WARN_MARGIN, build_wafer_thermal  # noqa: E402

if len(sys.argv) != 2:
    raise SystemExit("usage: build_thermal_fixture.py <RawResult.csv|data-directory>")

source = Path(sys.argv[1]).expanduser()
csv_paths = (
    [source]
    if source.is_file()
    else sorted(source.glob("A12345_W*_RawResult.csv"))
)
if not csv_paths:
    raise SystemExit(f"no RawResult CSV found: {source}")

csv_path = csv_paths[0]
info = import_csv(str(csv_path), wafer_override="W01")
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
print("loaded", Path(csv_path).name, len(fails["rows"]), "fail rows,", len(fails["events"]), "events")

if len(csv_paths) > 1:
    fail_fixtures = {}
    for index, path in enumerate(csv_paths):
        match = path.stem.split("_W")[-1].split("_")[0]
        wafer = f"W{int(match):02d}"
        info = import_csv(str(path), lot_override="A12345", wafer_override=wafer, reset=index == 0)
        data = runtime_state.wafer_fails(info["lot"], wafer)
        if data is not None:
            fail_fixtures[wafer] = {"sourceCsv": path.name, **data}
    all_fail_out = out.parent / "failFixtures.json"
    all_fail_out.write_text(json.dumps(fail_fixtures, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", all_fail_out, len(fail_fixtures), "wafer fixtures")

    wafer_maps = {}
    for wafer in fail_fixtures:
        data = runtime_state.wafer_map("A12345", wafer)
        if data is not None:
            wafer_maps[wafer] = data
    map_out = out.parent / "waferMapFixtures.json"
    map_out.write_text(json.dumps(wafer_maps, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", map_out, len(wafer_maps), "wafer fixtures")

    # Keep every frontend fallback on the same 25-CSV-derived backend logic.
    # W01 is the initial dashboard context; users can still switch to W02-W25.
    runtime_state.start_wafer("W01")
    w01_devices = [
        entry.model_copy(deep=True)
        for entry in runtime_state.devices
        if entry.device.wafer == "W01"
    ]
    summary_fixtures = {
        "dashboard": build_snapshot(w01_devices, "A12345", "W01", []),
        "siteSummaries": runtime_state.site_summaries(),
        "siteResults": {
            str(site): runtime_state.site_results(site)
            for site in sorted({entry.device.site for entry in runtime_state.devices})
        },
        "lots": runtime_state.lots(),
        "lotSummaries": {
            "A12345": runtime_state.lot_summary("A12345"),
        },
        "trends": runtime_state.trends(),
        "explanations": runtime_state.failure_explanations(100),
    }
    summary_out = out.parent / "csvSummaryFixtures.json"
    summary_out.write_text(json.dumps(summary_fixtures, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", summary_out)
