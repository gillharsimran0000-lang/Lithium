# Spatial model experiments

Target: spatial R² ≥ 0.90. This is a target, not an achieved score.

All main experiments retain the original 221 sample IDs and the same 5 outer
GroupKFold splits based on 0.2-degree geographic blocks. Four inner geographic
folds choose settings and feature sets without outer-test lithium values.
No difficult samples are removed, and neither lithium nor sample IDs are inputs.

## Current experiment scripts

- `benchmark_spatial_expansion.py`: 37 configurations over 3 feature sets (111 combinations). Extra Trees, gradient boosting, support vector regression, kernel ridge, and a mean of the three candidates selected by inner-fold MSE.
- `benchmark_gaussian_process.py`: 8 kernel/feature configurations, including learned per-feature length scales.
- `benchmark_catboost.py`: 18 native-categorical configurations; requires `requirements-experiments.txt`.
- `validate_spatial_ensemble.py`: additional random-split and original USGS 45-well split evaluations for the top-three selection procedure.

Run from the repository root, for example:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python ml/benchmark_spatial_expansion.py
```

Results are recorded under `data/processed/`. Benchmark scripts do not change production
model artifacts. `train_spatial_ensemble.py` verifies predictions, checks improvement
on all three point-prediction evaluations, archives the previous model, and publishes
the selected ensemble. Repeated family comparisons reuse the development benchmark,
so a higher development R² is not proof of improvement on an independent region.

Original predictor features are retained as one candidate feature set. Expanded
features add available rock-layer elevations, midpoint depth, relative depth,
normalized depth, temperature/depth, and optionally latitude/longitude. All are
available without observing lithium; location-aware deployment must calculate
coordinates consistently for each prediction-grid cell.

## Interpretation

An R² target of 0.90 on this exact dataset requires RMSE ≈ 40.2 mg/L. The deployed
ensemble has RMSE 61.1 mg/L. Reaching the target requires approximately
57% less squared error, not a small change in a display label.

Predictions, training settings, and unsuccessful experiments are retained. No
model is automatically promoted merely because its displayed R² rounds upward.

## Completed results

| Procedure | Spatial R² | MAE (mg/L) | RMSE (mg/L) |
|---|---:|---:|---:|
| Previous Extra Trees | 0.750 | 44.9 | 63.6 |
| Expanded-feature family selection | 0.727 | 48.6 | 66.5 |
| Top-three ensemble | 0.769 | 43.2 | 61.1 |
| Four-member 50:50 blend (deployed) | **0.792** | **40.2** | **58.0** |
| Gaussian process selection | 0.700 | 49.6 | 69.7 |
| CatBoost selection | 0.729 | 46.8 | 66.3 |
| Neighbourhood geology (dip, structural relief, 4/10/20 km means), top-three | 0.758 | 44.7 | 62.6 |
| Same, plus residual correction from nearby training wells | 0.754 | 44.5 | 63.1 |
| 2022 brine production (S&P Global, via USGS), top-five | 0.782 | 40.5 | 59.4 |
| Super learner: inner-fitted convex weights over the 15 best candidates, all feature sets (pre-declared single run) | 0.793 | 40.3 | 57.9 |

The deployed four-member blend achieves random-split R² 0.861 and USGS 45-well split R² 0.956
(`combined_spatial_validation.json`). The earlier top-three ensemble achieved random-split R² 0.864 (MAE 26.4, RMSE 46.9)
and USGS 45-well split R² 0.944 (MAE 22.4, RMSE 32.9). These improve on the
previous model's 0.852 and 0.941 respectively. The USGS split is a legacy
comparison and is not a new independent test set.

Nominal 90% interval: ±88.7 mg/L. Outer-fold interval coverage is 88.2%, below
the nominal target and lower than the previous model's 91.4%; improved point
predictions do not imply improved uncertainty calibration.

The 0.90 spatial target remains unmet. Further progress should investigate new
predictors and matched measurements, evaluated on a fresh geographic holdout,
rather than choosing a more favorable split or removing difficult wells.

## Why the spatial score stops near 0.8 (2026-10-22)

`benchmark_spatial_context.py` (outputs `spatial_context_benchmark.json` and, with
`--production`, `spatial_production_benchmark.json`) tested two new target-free information
sources from the USGS 2 km grids, computed in `spatial_context.py`. Neither beat the deployed
blend, so production artifacts were not changed. Residual correction chose zero strength in
three of five folds.

Pairs of wells under 1 km apart agree closely (semivariance about 700 against a total variance of
about 16,200), so measurement noise is small. Semivariance reaches the total variance by about
10 km, below the 20 km block size. Inside a held-out block, nearby wells therefore carry little
information, and the 2 km geology grids do not resolve variation over a few kilometres. The 20
worst wells contribute 58% of squared error; most are low-lithium samples beside high-lithium
wells on the same mapped geology. Reaching 0.85 needs about 28% less squared error (RMSE 49.3
mg/L against 58.0) and probably new measured predictors at finer scale. Re-running more model
families on this same benchmark mainly risks fitting the benchmark itself.

The super learner (`benchmark_superlearner.py`) was declared as the final attempt before it ran.
It matched the deployed blend (0.793 against 0.792) without a meaningful gain, so the deployed
model was kept and model search on this benchmark is closed.

## Repeat samples and the random split (2026-10-22)

60 of the 221 samples are repeats from 26 locations with identical coordinates. A plain random split
can put one sample from a well in training and another in testing, which flatters the score.
`validate_grouped_random.py` reruns the deployed procedure with outer and inner folds grouped by
location: R² 0.796, MAE 34.9, RMSE 57.4 (`grouped_random_validation.json`), against 0.861 for the plain
random split. The app now reports the grouped value as Test 1. The spatial-block test already keeps
repeats together. In the USGS 45-well split, 15 test wells share a location with a training well, which
affects both models equally, so that comparison remains fair but its absolute value is optimistic.

