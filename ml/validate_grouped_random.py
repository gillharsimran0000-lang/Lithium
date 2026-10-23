"""Test 1 (random wells hidden) again, with every sample from the same location kept on the same side.

60 of the 221 samples are repeats from 26 shared locations. In a plain random split, one sample from a
well can be in training while another from the same well is in testing, which flatters the score.
This reruns the deployed procedure (the 50:50 blend of the two selection procedures, with model
choice inside each training set) using location groups for both the outer and the inner splits.
"""
import json
import numpy as np
from sklearn.model_selection import GroupKFold
import validate_feature_selection as selection
import validate_spatial_ensemble as ensemble
from train_lithium_model import load_samples, scores, OUT


def location_groups(df, seed=42):
    key = df.LATITUDE.round(4).astype(str) + "," + df.LONGITUDE.round(4).astype(str)
    ids = {k: i for i, k in enumerate(np.random.default_rng(seed).permutation(key.unique()))}
    return key.map(ids).to_numpy()


def main():
    df = load_samples(); y = df.Li.to_numpy(float); groups = location_groups(df)
    a = np.zeros(len(y)); b = np.zeros(len(y))
    for i, (tr, te) in enumerate(GroupKFold(5).split(df, y, groups)):
        chosen, _ = ensemble.select_blend(df.iloc[tr], y[tr], groups[tr])
        a[te] = ensemble.predict(df.iloc[tr], y[tr], df.iloc[te], chosen)
        chosen, _ = selection.select_blend(df.iloc[tr], y[tr], groups[tr])
        b[te] = selection.predict(df.iloc[tr], y[tr], df.iloc[te], chosen)
        print("Grouped random fold", i + 1, scores(y[te], (a[te] + b[te]) / 2), flush=True)
    blend = (a + b) / 2
    report = {"protocol": "Deployed 50:50 procedure; five outer and four inner folds grouped by sample location.",
              "n_samples": len(y), "n_locations": int(len(np.unique(groups))),
              "random_cv_grouped_by_location": scores(y, blend), "predictions": blend.tolist()}
    (OUT / "grouped_random_validation.json").write_text(json.dumps(report, indent=1))
    print("FINAL", report["random_cv_grouped_by_location"], flush=True)


if __name__ == "__main__":
    main()
