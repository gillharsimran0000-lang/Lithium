"""Copy processed data into web/public/data in the shapes the web app reads, and copy the files the API
reads at runtime into api/data so the api/ folder deploys on its own. Run after the other ml/ scripts."""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
WEB = ROOT / "web" / "public" / "data"
API_DATA = ROOT / "api" / "data"
API_FILES = [
    "processed/ml_metrics.json",
    "processed/usgs_grid.json",
    "raw/usgs_smackover_li/input/exvars/SAR_modeldomain_rasterstack.txt",
    *(f"raw/usgs_smackover_li/grid/SAR_modeldomain_4269.{ext}" for ext in ("shp", "shx", "dbf", "prj")),
]


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    usgs = json.loads((DATA / "usgs_grid.json").read_text())
    ml = {c["cell"]: c for c in json.loads((DATA / "ml_grid.json").read_text())}
    features = []
    for c in usgs:
        m = ml.get(c["cell"])
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [c["ring"]]},
            "properties": {
                "cell": c["cell"], "usgs_pred": c["pred"], "usgs_p5": c["p5"], "usgs_p95": c["p95"],
                "ml_pred": m["pred"] if m else None, "ml_low": m["low"] if m else None, "ml_high": m["high"] if m else None,
            },
        })
    (WEB / "grid.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                                 separators=(",", ":")))
    for name in ("wells.json", "domain.geojson", "ml_metrics.json"):
        shutil.copy(DATA / name, WEB / name)
    print(f"wrote {len(features)} grid cells and copied wells, domain, metrics to {WEB}")
    for name in API_FILES:
        (API_DATA / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / "data" / name, API_DATA / name)
    print(f"copied {len(API_FILES)} runtime files to {API_DATA}")


if __name__ == "__main__":
    main()
