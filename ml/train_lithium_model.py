"""
Train a machine-learning model that predicts lithium concentration (mg/L) in Smackover brine
from geology, using the same 221 samples and explanatory variables USGS used
(Knierim and others, 2024, doi:10.5066/P9QPRYZN).

What this script adds beyond the USGS release:
  1. Spatial cross-validation. Nearby wells have similar lithium, so a random split lets the model
     "peek" at neighbours of every test well. Grouping wells into ~20 km blocks keeps whole areas out
     of training, which is a harder and more honest test.
  2. Two simple baselines to beat: the average lithium value, and inverse-distance interpolation
     from nearby wells (which uses location only, no geology).
  3. Prediction intervals from cross-validation errors, with their measured coverage.

Outputs:
  api/models/lithium_model.joblib   trained model used by the API
  data/processed/ml_metrics.json    every number shown on the app's ML page
  data/processed/ml_grid.json       predictions for each 2 km cell of the USGS model domain
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import rasterio
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, KFold

ROOT = Path(__file__).resolve().parent.parent
USGS = ROOT / "data" / "raw" / "usgs_smackover_li"
OUT = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "api" / "models"

SEED = 42
BLOCK_DEG = 0.2  # spatial block size in degrees, about 20 km
INTERVAL = 0.90  # prediction interval coverage target

# Variables USGS kept after their preprocessing (2_SARLi_RFmodel.R).
NUMERIC = ["hosston_thickness", "cottonvalley_thickness", "buckner_thick", "h2s_class",
           "smackover_alt", "smackover_thick", "smck_temp_int", "DEPTH_FILL"]
CATEGORICAL = ["buckner_facies", "smackover_facies", "FRM_GRP"]

READABLE = {
    "hosston_thickness": "Hosston Formation thickness",
    "cottonvalley_thickness": "Cotton Valley Group thickness",
    "buckner_thick": "Buckner Formation thickness",
    "buckner_facies": "Buckner rock type (facies)",
    "h2s_class": "Hydrogen sulfide class",
    "smackover_alt": "Smackover top elevation",
    "smackover_thick": "Smackover thickness",
    "smackover_facies": "Smackover rock type (facies)",
    "smck_temp_int": "Smackover temperature",
    "DEPTH_FILL": "Sample depth",
    "FRM_GRP": "Formation sampled",
}


def load_samples():
    df = pd.read_csv(OUT / "usgs_ml_input.csv", dtype={"SITEID": str})
    df = df.replace(-9999, np.nan)
    # Fill missing sample depth from the geologic framework, exactly as USGS did.
    depth_alt = df.DEM_1km_m - df.DEPTH_m
    alt_fill = np.where(df.DEPTH_m.isna() & (df.FRM_GRP == "Smackover"),
                        df.smackover_alt - df.smackover_thick / 2,
               np.where(df.DEPTH_m.isna() & (df.FRM_GRP == "Nuevo Leon Grp"),
                        df.hosston_alt - df.hosston_thickness / 2,
               np.where(df.DEPTH_m.isna() & (df.FRM_GRP == "Cotton Valley"),
                        df.cottonvalley_alt - df.cottonvalley_thickness / 2, depth_alt)))
    df["DEPTH_FILL"] = np.round(np.where(df.DEPTH_m.isna(), df.DEM_1km_m - alt_fill, df.DEPTH_m))
    return df


def encode(df, columns=None):
    """One-hot encode the categorical variables. Pass `columns` to match the training layout."""
    X = pd.get_dummies(df[NUMERIC + CATEGORICAL].astype({c: str for c in CATEGORICAL}),
                       columns=CATEGORICAL, dtype=float)
    if columns is not None:
        X = X.reindex(columns=columns, fill_value=0.0)
    return X


def spatial_blocks(lat, lon):
    return (np.floor(lat / BLOCK_DEG).astype(int) * 1000 + np.floor(lon / BLOCK_DEG).astype(int))


def idw_predict(train_xy, train_y, test_xy, k=8, power=2):
    """Inverse-distance weighting: average of the k nearest wells, closer wells count more."""
    preds = []
    for x, y in test_xy:
        d = np.hypot(train_xy[:, 0] - x, train_xy[:, 1] - y)
        nearest = np.argsort(d)[:k]
        w = 1 / np.maximum(d[nearest], 1e-4) ** power
        preds.append(np.sum(w * train_y[nearest]) / np.sum(w))
    return np.array(preds)


def scores(y, p):
    return {"mae": round(mean_absolute_error(y, p), 1),
            "rmse": round(float(np.sqrt(mean_squared_error(y, p))), 1),
            "r2": round(r2_score(y, p), 3)}


CANDIDATES = {
    "random_forest": [
        RandomForestRegressor(n_estimators=500, max_features=mf, min_samples_leaf=leaf, random_state=SEED, n_jobs=-1)
        for mf in (0.33, 0.6) for leaf in (2, 5)
    ],
    "gradient_boosting": [
        HistGradientBoostingRegressor(max_depth=d, learning_rate=0.05, max_iter=300, min_samples_leaf=10,
                                      random_state=SEED)
        for d in (3, 5)
    ],
}


def pick_by_inner_cv(family, X, y, groups):
    """Choose hyperparameters using only the training data handed in (nested cross-validation)."""
    inner = GroupKFold(n_splits=4)
    best, best_mae = None, np.inf
    for model in CANDIDATES[family]:
        errs = []
        for tr, te in inner.split(X, y, groups):
            m = clone_fit(model, X.iloc[tr], y[tr])
            errs.append(mean_absolute_error(y[te], m.predict(X.iloc[te])))
        if np.mean(errs) < best_mae:
            best, best_mae = model, np.mean(errs)
    return best


def clone_fit(model, X, y):
    from sklearn.base import clone
    return clone(model).fit(X, y)


def cross_validate(df, X, y, splitter, groups=None):
    """Out-of-fold predictions for each method. Every prediction comes from a model that never saw that well."""
    xy = df[["LONGITUDE", "LATITUDE"]].to_numpy()
    oof = {name: np.zeros(len(y)) for name in ["mean", "idw", "random_forest", "gradient_boosting"]}
    importances = []
    inner_groups = groups if groups is not None else np.arange(len(y))
    for tr, te in splitter.split(X, y, groups):
        oof["mean"][te] = y[tr].mean()
        oof["idw"][te] = idw_predict(xy[tr], y[tr], xy[te])
        for family in CANDIDATES:
            model = clone_fit(pick_by_inner_cv(family, X.iloc[tr], y[tr], inner_groups[tr]), X.iloc[tr], y[tr])
            oof[family][te] = model.predict(X.iloc[te])
            if family == "random_forest":
                imp = permutation_importance(model, X.iloc[te], y[te], n_repeats=10, random_state=SEED,
                                             scoring="neg_mean_absolute_error")
                importances.append(pd.Series(imp.importances_mean, index=X.columns))
    return oof, pd.concat(importances, axis=1).mean(axis=1)


def group_importance(per_column):
    """Add the one-hot columns back together so each geologic variable gets one score."""
    totals = {}
    for col, value in per_column.items():
        base = next(v for v in NUMERIC + CATEGORICAL if col == v or col.startswith(v + "_"))
        totals[base] = totals.get(base, 0) + value
    ranked = sorted(totals.items(), key=lambda kv: -kv[1])
    return [{"variable": k, "label": READABLE[k], "mae_increase_mg_l": round(v, 2)} for k, v in ranked]


def predict_grid(model, columns, half_width):
    stack = pd.read_csv(USGS / "input" / "exvars" / "SAR_modeldomain_rasterstack.txt").replace(-9999, np.nan)
    stack["DEPTH_FILL"] = stack.smackover_middepth
    stack["FRM_GRP"] = "Smackover"
    stack.loc[stack.smackover_facies == 1, "smackover_facies"] = 0  # facies 1 absent from training (as USGS)
    pred = model.predict(encode(stack, columns))
    with rasterio.open(USGS / "grid" / "SAR_modeldomain_mask.tif") as src:
        mask = src.read(1).ravel()
    return [{"cell": i, "pred": round(float(p), 1), "low": round(max(0.0, p - half_width), 1),
             "high": round(float(p + half_width), 1)}
            for i, p in enumerate(pred) if mask[i] == 1]


def main():
    df = load_samples()
    y = df.Li.to_numpy(dtype=float)
    X = encode(df)
    blocks = spatial_blocks(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())
    print(f"{len(y)} samples, {X.shape[1]} encoded features, {len(np.unique(blocks))} spatial blocks")

    spatial_oof, spatial_imp = cross_validate(df, X, y, GroupKFold(n_splits=5), blocks)
    random_oof, _ = cross_validate(df, X, y, KFold(n_splits=5, shuffle=True, random_state=SEED))

    results = {name: {"spatial_cv": scores(y, spatial_oof[name]), "random_cv": scores(y, random_oof[name])}
               for name in spatial_oof}
    for name, r in results.items():
        print(f"{name:18s} spatial {r['spatial_cv']}   random {r['random_cv']}")

    # USGS's own published holdout predictions, for comparison with their random 80/20 split.
    usgs = pd.read_csv(USGS / "output" / "SAR_Lipreds.csv", encoding="utf-8-sig", dtype={"SITEID": str})
    usgs_hold = usgs[usgs.mtype == "holdout"]
    usgs_scores = scores(usgs_hold.Li, usgs_hold.Li_pred)

    # Same 80/20 split as USGS, so the two models are tested on identical wells.
    role = df.SITEID.map(dict(zip(usgs.SITEID, usgs.mtype)))
    tr, te = (role == "train").to_numpy(), (role == "holdout").to_numpy()
    final_family = min(["random_forest", "gradient_boosting"], key=lambda f: results[f]["spatial_cv"]["mae"])
    same_split_model = clone_fit(pick_by_inner_cv(final_family, X[tr], y[tr], blocks[tr]), X[tr], y[tr])
    ours_on_usgs_split = scores(y[te], same_split_model.predict(X[te]))
    print("USGS holdout (their model):", usgs_scores, " ours on same wells:", ours_on_usgs_split)

    # Prediction interval: 90% of spatial cross-validation errors were smaller than this.
    errors = np.abs(y - spatial_oof[final_family])
    half_width = float(np.quantile(errors, INTERVAL))
    coverage = float(np.mean(errors <= half_width))

    final = clone_fit(pick_by_inner_cv(final_family, X, y, blocks), X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final, "columns": list(X.columns), "half_width": half_width,
                 "family": final_family}, MODEL_DIR / "lithium_model.joblib")

    grid = predict_grid(final, list(X.columns), half_width)
    (OUT / "ml_grid.json").write_text(json.dumps(grid, separators=(",", ":")))

    metrics = {
        "target": "Lithium concentration in brine (mg/L)",
        "n_samples": int(len(y)),
        "n_spatial_blocks": int(len(np.unique(blocks))),
        "block_size_km": 20,
        "chosen_model": final_family,
        "chosen_params": {k: v for k, v in final.get_params().items()
                          if k in ("max_features", "min_samples_leaf", "n_estimators", "max_depth", "learning_rate", "max_iter")},
        "results": results,
        "usgs_holdout": {"usgs_model": usgs_scores, "this_model": ours_on_usgs_split, "n": int(te.sum())},
        "interval": {"target": INTERVAL, "half_width_mg_l": round(half_width, 1), "spatial_cv_coverage": round(coverage, 3)},
        "importance": group_importance(spatial_imp),
        "observed_vs_predicted": [
            {"id": sid, "lat": float(la), "lon": float(lo), "observed": float(o), "predicted": round(float(p), 1)}
            for sid, la, lo, o, p in zip(df.SITEID, df.LATITUDE, df.LONGITUDE, y, spatial_oof[final_family])
        ],
        "features": NUMERIC + CATEGORICAL,
        "feature_labels": READABLE,
    }
    (OUT / "ml_metrics.json").write_text(json.dumps(metrics, indent=1))
    print(f"chosen: {final_family}; 90% interval ±{half_width:.1f} mg/L (coverage {coverage:.2f}); {len(grid)} grid cells")


if __name__ == "__main__":
    main()
