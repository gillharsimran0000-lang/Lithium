"""Fixed-fold experiment: neighbourhood geology clues and residual correction.

Same 221 samples, same five outer geographic folds, four inner geographic folds for every choice.
Outer-test lithium values are never used to pick features, settings, or correction strength.
"""
import json
import hashlib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.kernel_ridge import KernelRidge
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from benchmark_spatial_expansion import feature_sets
import sys
from spatial_context import context_for_wells, production_for_wells
from train_lithium_model import load_samples, spatial_blocks, scores, OUT

STRUCTURE = ["smackover_dip_m_per_km", "smackover_dip_east", "smackover_dip_north",
             "smackover_relief_4km", "smackover_relief_10km", "smackover_relief_20km"]


def all_feature_sets(df):
    xs = feature_sets(df)
    ctx = context_for_wells(df)
    xs["geology_structure"] = pd.concat([xs["geology"], ctx[STRUCTURE]], axis=1)
    xs["geology_context"] = pd.concat([xs["geology"], ctx], axis=1)
    xs["location_context"] = pd.concat([xs["geology_location"], ctx], axis=1)
    if "--production" in sys.argv:
        prod = production_for_wells(df)
        xs = {"original": xs["original"], "geology": xs["geology"], "geology_location": xs["geology_location"],
              "geology_production": pd.concat([xs["geology"], prod], axis=1),
              "location_production": pd.concat([xs["geology_location"], prod], axis=1),
              "structure_production": pd.concat([xs["geology_structure"], prod], axis=1)}
    return xs


def candidates():
    result = {}
    for mf in [.33, .6, 1.]:
        for leaf in [1, 2, 4]:
            result[f"et_{mf}_{leaf}"] = ExtraTreesRegressor(n_estimators=300, max_features=mf, min_samples_leaf=leaf, random_state=42, n_jobs=-1)
    for depth in [2, 3]:
        result[f"gb_{depth}"] = GradientBoostingRegressor(n_estimators=300, learning_rate=.03, max_depth=depth, min_samples_leaf=4, subsample=.8, random_state=42)
    for k in [10, 20, "all"]:
        for c in [100, 500, 2000]:
            for gamma in [.01, .03, .08]:
                result[f"svr_{k}_{c}_{gamma}"] = make_pipeline(StandardScaler(), SelectKBest(f_regression, k=k), SVR(C=c, gamma=gamma, epsilon=5))
    for alpha in [.03, .1, .3]:
        for gamma in [.01, .03]:
            result[f"krr_{alpha}_{gamma}"] = make_pipeline(StandardScaler(), KernelRidge(alpha=alpha, kernel="rbf", gamma=gamma))
    return result


def km(df):
    return np.c_[df.LONGITUDE.to_numpy() * 93.0, df.LATITUDE.to_numpy() * 111.0]


def idw(src_xy, values, dst_xy, k, power=2):
    d = np.hypot(dst_xy[:, None, 0] - src_xy[None, :, 0], dst_xy[:, None, 1] - src_xy[None, :, 1])
    near = np.argsort(d, axis=1)[:, :k]
    w = 1 / np.maximum(np.take_along_axis(d, near, 1), 0.5) ** power
    return (w * values[near]).sum(1) / w.sum(1)


def choose_correction(xy, y, inner_pred, inner):
    """Pick residual-correction strength and neighbour count using training wells only."""
    resid = y - inner_pred
    best = (0.0, 8, mean_squared_error(y, inner_pred))
    for lam in [.25, .5, .75, 1.]:
        for k in [4, 8, 16]:
            p = inner_pred.copy()
            for a, b in inner:
                p[b] += lam * idw(xy[a], resid[a], xy[b], k)
            loss = mean_squared_error(y, np.maximum(p, 0))
            if loss < best[2]:
                best = (lam, k, loss)
    return best


def main():
    df = load_samples(); y = df.Li.to_numpy(float); xy = km(df)
    groups = spatial_blocks(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())
    xs = all_feature_sets(df); ms = candidates()
    names = ["selected", "top3", "top5", "top3_corrected", "top5_corrected"]
    oof = {n: np.zeros(len(y)) for n in names}; folds = []
    for fold, (tr, te) in enumerate(GroupKFold(5).split(df, y, groups)):
        inner = list(GroupKFold(4).split(tr, y[tr], groups[tr])); loss = {}; inner_preds = {}
        for fs, X in xs.items():
            for name, model in ms.items():
                p = np.zeros(len(tr))
                for a, b in inner:
                    p[b] = clone(model).fit(X.iloc[tr[a]], y[tr[a]]).predict(X.iloc[tr[b]])
                key = f"{fs}/{name}"; inner_preds[key] = np.maximum(p, 0)
                loss[key] = float(mean_squared_error(y[tr], inner_preds[key]))
        ranked = sorted(loss, key=loss.get); test = {}
        for key in ranked[:5]:
            fs, name = key.split("/")
            test[key] = np.maximum(clone(ms[name]).fit(xs[fs].iloc[tr], y[tr]).predict(xs[fs].iloc[te]), 0)
        oof["selected"][te] = test[ranked[0]]
        corrections = {}
        for n in (3, 5):
            blend = np.mean([test[k] for k in ranked[:n]], axis=0)
            blend_inner = np.mean([inner_preds[k] for k in ranked[:n]], axis=0)
            oof[f"top{n}"][te] = blend
            lam, k, _ = choose_correction(xy[tr], y[tr], blend_inner, inner)
            fix = lam * idw(xy[tr], y[tr] - blend_inner, xy[te], k) if lam else 0
            oof[f"top{n}_corrected"][te] = np.maximum(blend + fix, 0)
            corrections[f"top{n}"] = {"strength": lam, "neighbours": k}
        folds.append({"fold": fold, "test_ids": df.SITEID.iloc[te].tolist(), "ranked": ranked[:5],
                      "correction": corrections, "inner_mse": loss})
        print("FOLD", fold + 1, ranked[:5], corrections, {n: scores(y[te], v[te]) for n, v in oof.items()}, flush=True)
    report = {"protocol": "Same 221 samples and five outer geographic folds as all earlier experiments. Features, settings, "
                          "blend members and residual-correction strength chosen with four inner geographic folds only. "
                          "Reused development benchmark, not independent validation.",
              "sample_ids": df.SITEID.tolist(), "sample_id_sha256": hashlib.sha256("\n".join(df.SITEID).encode()).hexdigest(),
              "folds": folds, "scores": {n: scores(y, v) for n, v in oof.items()},
              "predictions": {n: v.tolist() for n, v in oof.items()}}
    (OUT / ("spatial_production_benchmark.json" if "--production" in sys.argv else "spatial_context_benchmark.json")).write_text(json.dumps(report, indent=1))
    print("FINAL", report["scores"], flush=True)


if __name__ == "__main__":
    main()
