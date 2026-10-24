# Lithium Lens: full project summary, version 2 (for writing a demo script)

> **Paste everything below into ChatGPT, starting with this prompt:**
>
> "Write a script for a demo video of my Congressional App Challenge app, Lithium Lens, for judges from Rep. Steve Womack's office. Use plain language for non-scientists. Keep it within the contest's video length limit, about 2–3 minutes, and include what to show on screen at each moment. Use only the facts below. Do not invent numbers, and follow the honesty notes at the end."

---

## 0. What changed in this update

- **More honest accuracy.**
  - 60 of the 221 training samples are repeat samples from 26 wells.
  - In a plain random test, the model can learn from one sample of a well and be tested on another sample of the same well. That made "Test 1" look like 0.86.
  - With each well's samples kept together, Test 1 is **0.80**. The hardest test (whole regions hidden) is unchanged at **0.79**.
  - Both honest tests now agree at about 0.8.
- **New data-quality check** on the ML page: "Is the data good enough for machine learning?"
- **Corrected rock layers (stratigraphy)** in the drawing, matching the published USGS study, with real depths from the data.
- **New pages:** "What lithium is used for" (step 5) and "Questions people ask" (step 6, 11 questions).
- **Live simulation** of the recovery setup.
- **Chemistry sources checked against the papers.** Wrong or unconfirmed numbers were corrected:
  - Titanium material: capacity is now 29.7 mg/g (range 10.6–32.1) and it works best at pH 12, as the cited paper (Dai and others, 2021) reports. Its magnesium selectivity is now a range from 48 to 5,441, since 5,441 came from a different study.
  - Manganese material: capacity is now 21.2 mg/g (range 6.6–27), as the cited paper (Karshyga and others, 2023) reports, and its pH response is fitted to that paper.
  - A manganese loss rate we could not find in any paper is now labelled as our assumption.
- **Chemistry fix:** manganese- and titanium-based materials release acid as they take up lithium. The model now counts the sodium hydroxide needed to neutralize it.
- **Fix:** manganese- and titanium-based materials now start at pH 10 and 11, where the cited studies show them working.
- **Result:** the optimizer now usually recommends the aluminum-based material for these brines.

## 1. The one-sentence version

Lithium Lens is a website that shows where the lithium is in southern Arkansas's underground salt water and estimates how much could be recovered, at what cost, with how much water, energy and pollution. It then shows what that lithium could mean for Arkansas, and it uses real U.S. Geological Survey (USGS) data throughout.

## 2. The problem

- Lithium powers rechargeable batteries in electric cars, phones, laptops and power-grid storage.
- Worldwide, 88% of lithium goes into batteries (USGS Mineral Commodity Summaries, February 2026).
- The United States imports more than half its lithium, mostly from Chile (54%) and Argentina (43%). In 2025, the only commercial U.S. lithium production was a single brine operation in Nevada (USGS 2026).
- Southern Arkansas has a lot of lithium dissolved in very salty water (brine) inside a rock layer called the Smackover Formation, about 2.4 km (1.5 miles) underground. USGS (2024) estimates 5 to 19 million tonnes of lithium in that brine. That is lithium in the ground, not all of it recoverable.
- **The question the app answers:** how can Arkansas recover more lithium from its brine while keeping the economic and environmental costs low?

## 3. Where Arkansas's lithium sits (geology)

**It is not ore.** Lithium worldwide comes from:

| Type | Where | How it's produced |
|---|---|---|
| Hard-rock ore (spodumene) | Mostly Australia | Mined and crushed |
| Salt-flat brine | Chile and Argentina | Evaporated in large ponds for months |
| Clay | Thacker Pass project, Nevada | Dug up |
| **Oilfield brine** | **Southern Arkansas** | **Pumped up through wells; lithium captured directly; brine returned underground. No open pits or evaporation ponds.** |

Southern Arkansas companies already pump this same brine to make bromine.

**Rock layers, top to bottom** (order from Knierim and others, 2024, *Science Advances*; depths are medians at the 221 USGS sample sites):

1. **Younger layers** near the surface (including the Tokio and Nacatoch formations).
2. **Hosston Formation**, sandstone. Top about **1.4 km** down, about 400 m thick.
3. **Cotton Valley Group**, sandstone and shale. Top about **1.7 km** down, about 640 m thick, down to the Smackover.
4. **Buckner Member of the Haynesville Formation**, anhydrite, about 60 m thick. It sits directly on top of the Smackover.
5. **Smackover Formation**, limestone with tiny round grains (oolite), which holds the **lithium brine**. Top about **2.4 km** down, about 60 m thick.
6. **Norphlet Formation** (sandstone), or the **Louann Salt** where the Norphlet is missing.

## 4. What the app does (one page at a time)

**Home.** Headline, short explanation, "Start with a sample" button, and links to the research pages (sample chemistry, optimizer, environmental impact, ML performance, sources and methods). Beside it is a drawn cross-section of the rock layers above, with the Smackover glowing with lithium.

**Step 1: Choose a sample.** A map of the 9 counties USGS studied (Bradley, Calhoun, Columbia, Hempstead, Lafayette, Miller, Nevada, Ouachita, Union), with 1,196 real USGS brine sample records. Users filter by county and pick a sample to see its lithium and chemistry. Missing measurements show as "not measured", never as zero. Clicking the map runs the machine-learning model for that spot.

**Step 2: Try a recovery setup.**
- Pick a direct lithium extraction (DLE) capture material: aluminum-based, manganese-based or titanium-based.
- Adjust temperature and processing time. Advanced settings hold pH, amount of material, stages and daily brine volume.
- Results update automatically: percent recovered (with a likely range), cost per kg, energy per kg and fresh water per kg.
- A **live simulation** shows what each setting does:
  - Brine colour changes with temperature.
  - Capture beads change with the amount of material, and tanks with the number of stages.
  - Lithium dots move onto the beads in proportion to recovery.
  - Magnesium sludge appears at high pH.
  - Meters show capture progress and how full the material is.
  - A sentence says what limits the result.
- An **optimizer** tests thousands of setups (about 1,600 to 16,000, depending on the sample) and recommends the best one for a goal (most lithium, lowest cost, lowest energy, or balanced), and explains why.

**Step 3: Compare setups.** Side by side: lithium recovered against energy, water, chemicals, CO₂ and cost. Export a CSV or a printable report.

**Step 4: Put it to use.** Scales a setup to a year of running, with sliders for plant size and lithium price. It shows:
- tonnes of lithium carbonate
- electric-car batteries it could supply (36.6 kg of lithium carbonate per average battery-electric car, Adamas Intelligence, 2023)
- market value (default about $17,000 per tonne, late September 2026)
- royalties to mineral-rights owners (Arkansas's 2.5% royalty, Arkansas Oil and Gas Commission, May 2025)
- the yearly fresh water, electricity (with how many homes' worth), CO₂ and operating cost

It also explains who could use the numbers: state and county leaders, landowners, and battery and car makers.

**Step 5: What lithium is used for.** The USGS worldwide breakdown:

| Use | Share |
|---|---|
| Batteries | 88% |
| Ceramics and glass | 4% |
| Lubricating greases | 2% |
| Air treatment | 1% |
| Steel casting | 1% |
| Medicine | 1% |
| Other | 3% |

The page also covers why a U.S. source matters and Arkansas's first big project (the South West Arkansas project, Lafayette and Columbia counties):
- 22,500 tonnes of lithium carbonate a year planned, enough for about 615,000 car batteries
- first production expected in 2029
- LG Energy Solution to buy 8,000 tonnes a year for 10 years (Arkansas Department of Commerce, August 2026)

**Step 6: Questions people ask.** Eleven plain answers:
1. Where is the lithium?
2. How much is there?
3. Is it a mine?
4. Is there lithium ore in Arkansas?
5. Water use
6. Environmental risks
7. Who gets paid?
8. When production starts
9. How accurate the app is
10. Why only southern Arkansas?
11. Where the data comes from

**Example result.** Sample MSU 3-22 in Lafayette County has 56.7 mg/L of lithium.
- Aluminum-based material at 60 °C for 1 hour: about 45% recovered, about $15 per kg of lithium.
- Three stages at 90 °C for 8 hours: about 88% recovered, about $23 per kg.

## 5. The data (all real and public)

| Data | Source |
|---|---|
| 37 brine samples collected in 2022 | USGS, Knierim and others (2024), doi:10.5066/P9QPRYZN |
| Historical brine samples, 1965–2018 | USGS National Produced Waters Geochemical Database v3.0, doi:10.5066/P9DSRCZJ |
| 1,196 sample records shown in the app, inside the USGS study area | Same two sources |
| 221 lithium samples used to train the model | The same samples USGS used in its peer-reviewed study (Knierim and others, 2024, *Science Advances*) |
| Geology maps (2 km grid): layer depths and thicknesses, rock type, temperature, hydrogen sulfide | USGS data release |
| Electricity CO₂ (741.7 lb per MWh, Arkansas grid) | U.S. EPA eGRID2023 |
| Electricity price (6.61 cents per kWh) | U.S. EIA |
| Capture-material performance | Published studies, all listed in the app |

**Is the data good enough for machine learning?** Yes, for regional patterns.

What's good:
- It is the same data USGS used.
- No lithium values are below detection limits.
- Only 6 of 221 depths were missing, filled from the geology the way USGS did.
- Repeat samples at the same spot agree within a median of 11 mg/L.

Limits:
- It is small: 221 samples from 187 locations, many from the 1960s and 70s with approximate locations.
- 60 samples are repeats from 26 locations, so the tests keep them together.
- 196 samples are from the Smackover and 25 from shallower layers with much less lithium.

It is good enough to show which regions are richer, but not for exact values at a single well.

## 6. The machine-learning model (predicts lithium concentration from geology)

- **What it does:** predicts lithium (mg/L) in the brine at any 2 km map square from the rock layers, depth, temperature and location.
- **Model:** four models voting together (support vector regression and Extra Trees), chosen using training data only.
- **What R² means:** 1 means perfect, and 0 means no better than guessing the average.
- **Scores** (every test uses wells the model never saw):
  - **Test 1, random wells hidden:** **0.80**. Each well's repeat samples are kept together. A plain random split would show 0.86, but that counts the model recognising wells it has already seen.
  - **Test 2, USGS's own 45 test wells:** **0.96**, against **0.93** for USGS's own model on the same wells. This comparison is fair because both models use the same split. The absolute number is optimistic, because 15 of the 45 test wells share a location with a training well, for both models.
  - **Test 3, whole regions hidden (hardest):** **0.79**, about 0.8. Southern Arkansas was cut into 22 squares about 20 km across, and whole squares were hidden. This is closest to predicting where nobody has drilled. The typical miss is about 40 mg/L.
- **Compared with simpler methods (Test 3):**
  - guessing the average: −0.06
  - copying the nearest wells: 0.13
  - the original random forest: 0.69
  - our model: 0.79
- **Most important clues:** hydrogen sulfide class, Smackover top elevation, sample depth, Smackover rock type, and the formation sampled.
- **Uncertainty:** 9 out of 10 true values fell within ±88 mg/L.
- **Why it stops near 0.8:**
  - More than 200 model setups were tested.
  - Nearby wells (within 1 km) agree closely, but lithium changes over a few kilometres, and the 2 km geology maps (largely from a 1969 study) are too coarse to capture that.
  - Doing better needs new, finer data.
  - We refused to make scores look better by making tests easier or deleting hard wells. We also corrected Test 1 downward when we found the repeat-sample issue.

## 7. The recovery model (literature-based chemistry, NOT machine learning)

No public dataset of DLE experiments existed to train on, so recovery is calculated from published chemistry:

1. **pH adjustment.** Adding sodium hydroxide raises pH. Magnesium and calcium drop out as sludge past their solubility limits.
2. **Competition.** Lithium and magnesium compete for spots on the capture material (a competitive Langmuir isotherm with a mass balance).
3. **Speed.** Capture approaches its limit over time and is faster when warmer (first-order kinetics with an Arrhenius temperature effect).
4. **Washing off and losses.** Washing the lithium off the material, and small losses.

- **Uncertainty:** the model runs 500 times with uncertain inputs, and the app shows the 5th–95th percentile range.
- Every number has a source or is clearly labelled as an assumption.
- **Real chemistry the app shows:**
  - Manganese and titanium materials only work in less acidic water.
  - More time stops helping once the material is full.
  - pH above about 9 creates magnesium sludge, which adds cost.

## 8. How it was built, and backend quality

- **Website:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, MapLibre, Recharts.
- **Backend:** Python 3.12, FastAPI, scikit-learn 1.9.1, pandas, NumPy, Shapely.
- **Speed:**
  - recovery estimate: about 0.01 s
  - optimizer, 8,100 setups (sample MSU 3-22): about 0.3 s
  - map prediction: about 0.07 s
- **Quality:**
  - 17 automated tests, all passing.
  - Inputs are checked, with clear errors for bad values.
  - Points outside the study area are rejected politely.
  - The app works without the interactive map on computers that can't draw it.
  - It respects "reduce motion" settings and works on phones.

## 9. Limitations (say these honestly)

- Recovery numbers come from a chemistry model built on published studies, not experiments on these brines.
- Not modelled: temperature effects on capacity, temperature effects on pH and solubility, sodium and calcium competition, brine buffering, and plant building costs.
- Costs cover energy, chemicals and sorbent only, not equipment, labour or refining.
- The recovery model has not been checked against experiments on Arkansas brine. Several key numbers (lithium affinity, uptake speed, prices) are our assumptions, and the app labels them.
- The ML model shows regional patterns (±88 mg/L), not exact single-well values.
- Lithium in the ground (resource) is not lithium recoverable at a profit (reserve).
- Not covered: leaks, earthquakes, land use, traffic. Those need site studies.
- Prices and company plans change.

## 10. Future work

- **Other regions of Arkansas.** They have different rock layers, only 6 lithium measurements outside the south (all in Van Buren County, given one estimated location), and no matching geology maps. They would need new samples and mapping.
- **New, carefully located wells in the study area,** for a truly independent test.
- **Lab or pilot tests** of DLE on real Arkansas brine, to check the recovery model.

## 11. Honesty notes for the script (keep these)

- Only the lithium-concentration model is machine learning. Never call the recovery model AI or ML.
- **Use 0.80 / 0.79 ("about 0.8") for the honest tests.** Do not use 0.86. If mentioning 0.96, say it is a comparison with USGS's own model on USGS's own test wells.
- Present the repeat-sample correction as a strength: the student found a flaw that made the model look better and fixed it.
- **AI use:** the student discloses AI help in a separate AI disclosure document, as the contest rules require. The script must not claim that AI wasn't used, and it should describe the student's own role accurately.
