"""Copy processed data into web/public/data in the shapes the web app reads. Run after the other ml/ scripts."""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
WEB = ROOT / "web" / "public" / "data"


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


if __name__ == "__main__":
    main()
