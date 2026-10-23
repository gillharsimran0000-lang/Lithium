"""Check published model, benchmark, and browser data cannot silently disagree."""
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.metrics import r2_score, mean_absolute_error
ROOT = Path(__file__).resolve().parents[2]


def test_published_scores_match_out_of_fold_predictions():
    metrics = json.loads((ROOT / 'data/processed/ml_metrics.json').read_text())
    rows = metrics['observed_vs_predicted']
    y = [row['observed'] for row in rows]
    predictions = [row['predicted'] for row in rows]
    score = metrics['results'][metrics['chosen_model']]['spatial_cv']
    assert abs(r2_score(y, predictions) - score['r2']) < .001
    assert abs(mean_absolute_error(y, predictions) - score['mae']) < .1
    assert len({row['id'] for row in rows}) == metrics['n_samples'] == 221
    assert metrics == json.loads((ROOT / 'web/public/data/ml_metrics.json').read_text())
    assert metrics == json.loads((ROOT / 'api/data/processed/ml_metrics.json').read_text())


def test_model_family_and_grid_match_published_artifacts():
    metrics = json.loads((ROOT / 'data/processed/ml_metrics.json').read_text())
    model = joblib.load(ROOT / 'api/models/lithium_model.joblib')
    assert model['family'] == metrics['chosen_model']
    assert model['family'] in {'extra_trees', 'spatial_ensemble'}
    grid = json.loads((ROOT / 'data/processed/ml_grid.json').read_text())
    web = json.loads((ROOT / 'web/public/data/grid.geojson').read_text())
    by_id = {cell['cell']: cell for cell in grid}
    assert len(by_id) == len(grid)
    assert all(np.isfinite(cell['pred']) for cell in grid)
    for feature in web['features']:
        props = feature['properties']
        if props['cell'] in by_id:
            assert props['ml_pred'] == by_id[props['cell']]['pred']


def test_live_predictions_match_map_grid():
    from app.ml_service import cells, predict_at
    grid = json.loads((ROOT / 'data/processed/ml_grid.json').read_text())
    for row in (grid[0], grid[len(grid)//2], grid[-1]):
        center = cells()[row['cell']].representative_point()
        live = predict_at(center.y, center.x)
        assert live['in_domain']
        assert live['prediction_mg_l'] == row['pred']
        assert live['prediction_mg_l'] >= 0
