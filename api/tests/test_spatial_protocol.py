"""Protect the geographic benchmark from accidental leakage and target changes."""
import json
import sys
from pathlib import Path
import numpy as np
import pytest
from sklearn.model_selection import GroupKFold
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml'))
from train_lithium_model import load_samples, spatial_blocks
from benchmark_spatial_expansion import feature_sets


def test_expanded_features_do_not_use_target_or_sample_identity():
    df = load_samples()
    changed = df.copy()
    changed['Li'] = np.arange(len(df)) * 1000
    changed['SITEID'] = 'arbitrary'
    original, modified = feature_sets(df), feature_sets(changed)
    for name in original:
        assert original[name].equals(modified[name])
        assert np.isfinite(original[name].to_numpy()).all()


@pytest.mark.parametrize("filename", ["spatial_expansion_benchmark.json", "feature_selection_benchmark.json"])
def test_expanded_benchmark_uses_original_spatial_folds_and_all_samples(filename):
    df = load_samples()
    report = json.loads((ROOT / 'data/processed' / filename).read_text())
    assert report['sample_ids'] == df.SITEID.tolist()
    assert len(df) == report.get('n_samples', len(report['sample_ids'])) == 221
    groups = spatial_blocks(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())
    tested = []
    for fold, (train, test) in zip(report['folds'], GroupKFold(5).split(df, df.Li, groups)):
        assert not set(groups[train]).intersection(groups[test])
        assert fold['test_ids'] == df.SITEID.iloc[test].tolist()
        tested.extend(test)
    assert sorted(tested) == list(range(len(df)))


def test_live_and_benchmark_features_are_identical():
    from app.ml_features import make_features
    df = load_samples()
    assert make_features(df, expanded=True).equals(feature_sets(df)['geology_location'])
