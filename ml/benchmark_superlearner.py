"""Single pre-declared experiment: a super learner (stacked blend) on the fixed spatial folds.

Inside each outer training set, every candidate gets inner-fold out-of-fold predictions. The 15 best
are combined with non-negative weights that sum to 1, fitted to those inner predictions only.
Outer-test lithium values are used only for the final score. Declared before running; reported
whatever the result.
"""
import json
import hashlib
import numpy as np
import pandas as pd
from scipy.optimize import nnls
from sklearn.base import clone
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import GroupKFold
from benchmark_spatial_context import STRUCTURE, candidates
from benchmark_spatial_expansion import feature_sets
from spatial_context import context_for_wells, production_for_wells
from train_lithium_model import load_samples, spatial_blocks, scores, OUT

POOL = 15


def pool_feature_sets(df):
    xs = feature_sets(df)
    ctx, prod = context_for_wells(df), production_for_wells(df)
    xs["geology_structure"] = pd.concat([xs["geology"], ctx[STRUCTURE]], axis=1)
    xs["geology_production"] = pd.concat([xs["geology"], prod], axis=1)
    xs["location_production"] = pd.concat([xs["geology_location"], prod], axis=1)
    return xs


def convex_weights(P, y):
    """Non-negative weights summing to 1 that best reproduce y from the columns of P."""
    w, _ = nnls(np.vstack([P, 100 * np.ones(P.shape[1])]), np.r_[y, 100.0])
    return w / w.sum()


def main():
    df = load_samples(); y = df.Li.to_numpy(float)
    groups = spatial_blocks(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())
    xs = pool_feature_sets(df); ms = candidates()
    oof = {"superlearner": np.zeros(len(y)), "best_single": np.zeros(len(y))}; folds = []
    for fold, (tr, te) in enumerate(GroupKFold(5).split(df, y, groups)):
        inner = list(GroupKFold(4).split(tr, y[tr], groups[tr])); preds = {}
        for fs, X in xs.items():
            for name, model in ms.items():
                p = np.zeros(len(tr))
                for a, b in inner:
                    p[b] = clone(model).fit(X.iloc[tr[a]], y[tr[a]]).predict(X.iloc[tr[b]])
                preds[f"{fs}/{name}"] = np.maximum(p, 0)
        ranked = sorted(preds, key=lambda k: mean_squared_error(y[tr], preds[k]))[:POOL]
        w = convex_weights(np.column_stack([preds[k] for k in ranked]), y[tr])
        members = {k: float(v) for k, v in zip(ranked, w) if v > 1e-6}
        test = {}
        for key in members | {ranked[0]: 1.0}:
            fs, name = key.split("/")
            test[key] = np.maximum(clone(ms[name]).fit(xs[fs].iloc[tr], y[tr]).predict(xs[fs].iloc[te]), 0)
        oof["superlearner"][te] = sum(v * test[k] for k, v in members.items())
        oof["best_single"][te] = test[ranked[0]]
        folds.append({"fold": fold, "test_ids": df.SITEID.iloc[te].tolist(), "weights": members})
        print("FOLD", fold + 1, {k: round(v, 2) for k, v in members.items()},
              {n: scores(y[te], v[te]) for n, v in oof.items()}, flush=True)
    report = {"protocol": "Pre-declared single experiment. Same 221 samples and five outer geographic folds. Candidate "
                          "ranking and blend weights fitted on four inner geographic folds only. Reused development benchmark.",
              "sample_ids": df.SITEID.tolist(), "sample_id_sha256": hashlib.sha256("\n".join(df.SITEID).encode()).hexdigest(),
              "folds": folds, "scores": {n: scores(y, v) for n, v in oof.items()},
              "predictions": {n: v.tolist() for n, v in oof.items()}}
    (OUT / "superlearner_benchmark.json").write_text(json.dumps(report, indent=1))
    print("FINAL", report["scores"], flush=True)


if __name__ == "__main__":
    main()
