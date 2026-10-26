# Lithium Lens

A guided, one-screen-at-a-time research workspace for southern Arkansas lithium: the nine counties of the USGS Smackover study area, their USGS sample records, and direct lithium extraction (DLE) tools.

**Question:** How can Arkansas recover more lithium from its underground brine while keeping the economic and environmental costs of extraction low?

The app connects real USGS brine data to models of DLE so a user can:

1. find real brine samples on a map of the southern Arkansas study area, with county filters,
2. read each sample's chemistry, with missing values shown as missing,
3. see a **machine-learning model** that predicts lithium concentration from geology,
4. estimate lithium recovery for three DLE sorbents with a **literature-based chemistry model** (not ML, and labelled as such), with a live simulation that shows what each setting changes and what limits the result,
5. let an optimizer search thousands of operating setups (about 1,600 to 16,000, depending on the sample) for a chosen priority,
6. compare energy, water, chemicals, emissions and waste,
7. save scenarios, compare them, and export a CSV or a printable report,
8. scale a setup to a year of running: lithium carbonate, electric-car batteries, the value of the raw lithium at today's price (not a forecast of later sales), Arkansas's 2.5% royalty, and the water, electricity and CO₂ it would use,
9. see what lithium is used for worldwide and why a U.S. source matters (USGS Mineral Commodity Summaries 2026),
10. read plain answers to common questions about lithium in Arkansas.

The app shows one page at a time: a home page, then six steps (choose a sample, try a recovery setup, compare setups, put it to use, what it's used for, questions). The research tools open from the home page.

---

## Run it locally

You need Python 3.12 (with [uv](https://docs.astral.sh/uv/)) and Node.js 20+.

```bash
# 1. Python environment (once)
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r ml/requirements.txt

# 2. Start the API (terminal 1)
cd api
../.venv/bin/python -m uvicorn app.main:app --port 8000

# 3. Start the website (terminal 2)
cd web
npm install
npm run dev        # then open http://localhost:3000
```

Run the tests with `cd api && ../.venv/bin/pytest`.

### Rebuild the data and the ML model from the original USGS files

The processed files are already in `data/processed/` and `web/public/data/`. To rebuild them from scratch:

```bash
# Download the 80 MB USGS Produced Waters database (see data/README.md), then:
.venv/bin/python ml/prepare_data.py          # USGS files  -> wells.json, grids, domain
.venv/bin/python ml/benchmark_extra_trees.py # nested spatial evaluation
.venv/bin/python ml/train_improved_model.py  # verify, train, and publish Extra Trees
.venv/bin/python ml/export_web_data.py       # copies results into web/public/data
```

`data/processed/usgs_ml_input.csv` was produced by running USGS's own preparation script
(`data/raw/usgs_smackover_li/1_SARLi_dataprep.py`) unchanged except for skipping its optional `sciencebasepy` download step.

---

## Project layout

```
data/raw/            Original USGS downloads, unchanged
data/processed/      Cleaned data and model results
ml/                  Data preparation and ML training scripts (Python)
api/app/             FastAPI server
  assumptions.py       every number the recovery model uses, with its source
  process_model.py     the recovery, energy, water, cost and emissions calculations
  optimizer.py         grid search and the "why it differs" explanations
  ml_service.py        serves the trained lithium model
  main.py              API routes
api/tests/           Tests of the chemistry and maths
web/src/app/         Guided steps on one route, with redirects for old URLs (Next.js)
web/src/components/  Map, charts, forms, guided demo, expandable research tools
web/src/lib/         Shared state, API calls, formatting
```

---

## How it works

### 1. Data (all real, all public)

* **37 brine samples collected by USGS in August 2022** (Knierim and others, 2024, [doi:10.5066/P9QPRYZN](https://doi.org/10.5066/P9QPRYZN)). Lithium ranges from 0.65 to 252 mg/L.
* **Historical samples, 1965–2018**, from the USGS National Produced Waters Geochemical Database v3.0 ([doi:10.5066/P9DSRCZJ](https://doi.org/10.5066/P9DSRCZJ)), kept only inside the USGS southern Arkansas model area.
* Sample counts are calculated from the bundled data. Codes such as −9999 become "not measured", never zero.
* The database's combined temperature column is mostly lab temperature (68 °F), so only the reported well temperature is used.

### 2. Machine learning: lithium concentration from geology

**In plain terms:** the model looks at the rock layers, depth, temperature and location of a spot in southern Arkansas and estimates how much lithium the brine there holds. We graded it with a score called R², which runs from 0 (no better than guessing the average) to 1 (perfect). Every test uses wells the model never saw while learning.

| Test | Score (R²) | What it means |
|---|---|---|
| 1. Random wells hidden | **0.80** | Explains 80% of the well-to-well differences. Repeat samples from the same well are kept together (a plain random split shows 0.86, because 60 samples are repeats from 26 wells) |
| 2. USGS's own 45 test wells | **0.96** | Beats the U.S. Geological Survey's own model (0.93) on the same wells |
| 3. Whole regions hidden (hardest) | **≈0.8** (0.792) | On parts of the map it never saw, it still explains 79%. Typical miss is about 40 mg/L |

Test 3 is the hardest and most honest: it is closest to the real job of predicting lithium where nobody has drilled.

* **Model:** four models voting together (support vector regression and Extra Trees); members selected inside each training fold.
* **Data:** the same 221 USGS samples, with original geology, derived depth features, and location.
* **Testing:** spatial cross-validation. The area is cut into ~20 km blocks, and the model is always tested on blocks it never trained on. Settings are tuned inside each training set (nested cross-validation).

| Method | R², random split (Test 1) | R², whole areas held out (Test 3) |
|---|---|---|
| Average value (no model) | −0.01 | −0.06 |
| Nearest-well interpolation (location only) | 0.85 | 0.13 |
| Original random forest on geology | 0.82 | 0.69 |
| Previous Extra Trees on geology | 0.852 | 0.750 |
| Current spatial ensemble | **0.861** (0.796 with repeat samples kept together) | **0.792** |
| Gradient boosting on geology | 0.80 | 0.56 |

**Key finding:** location-only interpolation performs much worse when geographic blocks are held out. Combining geology and location improves the current development benchmark. Wells can still be close across block boundaries.

### 3. Recovery model (literature-based, not ML)

No public dataset of DLE experiments suitable for training was found, so recovery is **calculated**, not learned. For each sorption stage:

1. **pH adjustment.** Sodium hydroxide raises pH. Magnesium and calcium hydroxide precipitate when their solubility products are exceeded.
2. **Competitive Langmuir isotherm plus mass balance.** Lithium and magnesium compete for sorbent sites. The equation is solved exactly as a quadratic.
3. **First-order kinetics.** The rate speeds up with temperature (Arrhenius).
4. **Elution and losses.** Elution efficiency and sludge losses give the lithium actually recovered.

Parameters come from published studies, government data and market reports. Where a source does not report the exact number the model needs, the value is labelled "Assumption based on" that source, with a note on how it was set. Every one is listed with its source in `api/app/assumptions.py` and on the Methodology page.

**Uncertainty:** the model runs 500 times with parameters drawn from their low, likely and high values. The app reports the 5th–95th percentile.

### 4. Optimizer

* **Method:** exhaustive grid search over technology, temperature, pH, contact time, sorbent dose and number of stages.
* **Ranking:** results are ranked by the chosen priority: maximum recovery, minimum cost, minimum energy, or a balanced score.
* **Explanations:** the reasons shown for a recommendation are generated from the model's own numbers.

**Example:** a hot, lithium-rich brine (BSW 22S, 86 °C) gets half the contact time of a cooler one (MSU 3-22, 60 °C), because uptake is faster when warm. Its cost per kg is about a third.

---

## Limitations

* **Recovery estimates** come from a chemistry model, not from experiments on these brines.
* **Some effects are not modelled:** temperature effects on capacity, temperature effects on pH and solubility (25 °C constants are used), sodium and calcium competition, brine buffering, and activity coefficients in concentrated brine.
* **Costs cover energy, chemicals and sorbent only:** not equipment, labour, or refining to lithium carbonate.
* **No test against real results:** the recovery model has not been checked against experiments on Arkansas brine, and several of its key numbers (uptake speed, eluate strength, sorbent prices) are assumptions based on lab studies, patents or market reports rather than Arkansas plant data. One, the share of heat recovered from outgoing brine, has no published source yet.
* **The ML model's interval is wide (±88 mg/L).** It shows regional patterns, not single-well values.
* **Southern Arkansas only.** The app covers the USGS study area (Bradley, Calhoun, Columbia, Hempstead, Lafayette, Miller, Nevada, Ouachita and Union counties).
* **Resource is not reserve.** The USGS 5.1–19 Mt figure is lithium in place, not what can be recovered economically.

## Future work

* **Other regions of Arkansas.** Outside the south, brines come from different rock layers (for example, the Fayetteville Shale in Van Buren County). The USGS database holds only 6 lithium measurements there, all given one estimated location, and there are no published geology maps of the kind the model uses. Covering those regions would first need new brine samples and new geologic mapping.
* **New wells in the study area.** Fresh lithium measurements, especially from areas with few wells, would give a truly independent test of the model.

## Deploying

* **Website:** deploys to Vercel from the `web/` folder.
  * Set `NEXT_PUBLIC_API_URL` to the API's address.
* **API:** deploys to Vercel as a second project from the `api/` folder (FastAPI preset, entrypoint `app/main.py`).
  * Any other Python host works too: `pip install -r requirements.txt`, then `uvicorn app.main:app --host 0.0.0.0 --port $PORT` from `api/`.
  * It reads its data from `api/data/`, which `ml/export_web_data.py` copies from `data/`.
  * Set `ALLOWED_ORIGINS` to the website's address.

## Guided interface and model provenance

The main workflow displays one screen at a time: choose a sample, calculate and save recovery setups, then compare. Hash navigation supports browser Back/Forward and existing URLs. Research tools are separate optional screens. The welcome photograph has bounded parallax, disabled for reduced-motion users.

The current ensemble reaches spatial R² 0.792, below the 0.85 target. All experiments retain the same 221 samples and five geographic outer folds. Four inner geographic folds select settings and features. Model-family comparisons reuse this development benchmark, so these results are not independent prospective validation. Original artifacts are preserved in `data/model_baseline/`; the previous Extra Trees model is in `data/model_extra_trees/`; the three-member ensemble is in `data/model_spatial_ensemble/`. Reproducible experiments and results are documented in `ml/EXPERIMENTS.md`.

Current spatial MAE: 40.2 mg/L (original 49.2); RMSE: 58.0 mg/L (original 70.9). The nominal 90% interval is ±87.7 mg/L, calibrated on out-of-fold development residuals. Widths estimated inside each outer training fold covered 89.6% of outer test observations, just below the nominal 90% target; coverage at new sites is not guaranteed.

### Simpler default workflow

The recovery screen asks only for a recovery option, then shows results. Temperature, time, pH, dose, stages, and volume remain under “Adjust technical settings”. The sample preview emphasizes lithium; full measurements remain in its disclosure. The duplicate guided-tour overlay was removed from the shell because the main workflow already provides step-by-step instructions. Research tools remain available through the evidence pages. Calculation logic and scientific limitations are unchanged.

The default recovery screen keeps temperature and processing time visible for hands-on exploration, alongside material choice. A reset button restores sample-based starting conditions and the default daily volume. Chemistry controls remain in Advanced settings.
