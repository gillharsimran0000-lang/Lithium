"""Serve the trained lithium-concentration model (see ml/train_lithium_model.py)."""

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shapefile
from .ml_features import make_features
from shapely.geometry import Point, shape

# api/data holds copies of the runtime files from the repo's data/ (written by ml/export_web_data.py),
# so the api/ folder can be deployed on its own.
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
USGS = ROOT / "data" / "raw" / "usgs_smackover_li"
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "lithium_model.joblib"


def encode(df, columns, expanded=False):
    return make_features(df, columns, expanded=expanded)


@lru_cache
def bundle():
    return joblib.load(MODEL_PATH)


@lru_cache
def metrics():
    return json.loads((DATA / "ml_metrics.json").read_text())


@lru_cache
def cells():
    reader = shapefile.Reader(str(USGS / "grid" / "SAR_modeldomain_4269"))
    return [shape(s.__geo_interface__) for s in reader.shapes()]


@lru_cache
def raster_stack():
    stack = pd.read_csv(USGS / "input" / "exvars" / "SAR_modeldomain_rasterstack.txt").replace(-9999, np.nan)
    stack["DEPTH_FILL"] = stack.smackover_middepth
    stack["FRM_GRP"] = "Smackover"
    stack.loc[stack.smackover_facies == 1, "smackover_facies"] = 0
    centroids = [cell.centroid for cell in cells()]
    stack["LATITUDE"] = [p.y for p in centroids]
    stack["LONGITUDE"] = [p.x for p in centroids]
    return stack


@lru_cache
def usgs_grid():
    return {c["cell"]: c for c in json.loads((DATA / "usgs_grid.json").read_text())}


def predict_at(lat, lon):
    """Run the model live on the geology of the 2 km cell containing (lat, lon)."""
    pt = Point(lon, lat)
    idx = next((i for i, c in enumerate(cells()) if c.contains(pt)), None)
    if idx is None:
        return None
    usgs = usgs_grid().get(idx)
    if usgs is None:
        return {"cell": idx, "in_domain": False,
                "message": "USGS masked this cell out because no training wells are similar to it."}
    b = bundle()
    row = raster_stack().iloc[[idx]]
    X = encode(row, b["columns"], expanded=b.get("expanded_features", False))
    pred = float(b["model"].predict(X)[0])
    if b.get("nonnegative", False):
        pred = max(0., pred)
    geology = {k: (None if pd.isna(v) else float(v)) for k, v in row.iloc[0].items() if k not in ("FRM_GRP",)}
    return {
        "cell": idx,
        "in_domain": True,
        "prediction_mg_l": round(pred, 1),
        "interval_mg_l": [round(max(0.0, pred - b["half_width"]), 1), round(pred + b["half_width"], 1)],
        "interval_note": f"90% of spatial cross-validation errors were within ±{b['half_width']:.0f} mg/L",
        "usgs_prediction_mg_l": usgs["pred"],
        "usgs_p5_p95_mg_l": [usgs["p5"], usgs["p95"]],
        "geology": geology,
    }
