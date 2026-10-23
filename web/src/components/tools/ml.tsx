"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Notice, PageHeader, Stat, Table } from "@/components/ui";
import { AXIS, GRID, Scatterplot, TOOLTIP } from "@/components/charts";
import { num } from "@/lib/format";
import type { MlMetrics } from "@/lib/types";

const METHOD_NAMES: Record<string, string> = {
  spatial_ensemble: "Our model (4 models voting, geology + location)",
  extra_trees: "Earlier version: Extra Trees on geology",
  mean: "Guess the average every time (no model)",
  idw: "Copy the nearest wells (location only)",
  random_forest: "Random forest on geology",
  gradient_boosting: "Gradient boosting on geology",
};

const pct = (r2: number) => `${Math.round(r2 * 100)}%`;

export default function MlPage() {
  const [m, setM] = useState<MlMetrics | null>(null);
  useEffect(() => {
    fetch("/data/ml_metrics.json").then((r) => r.json()).then(setM);
  }, []);
  if (!m) return (
    <div className="ml-skeleton" role="status" aria-label="Loading model results">
      <span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" />
    </div>
  );

  const rf = m.results[m.chosen_model];
  // Test 1 keeps every sample from the same well on the same side of the split when that result exists.
  const test1 = rf.random_cv_grouped ?? rf.random_cv;
  const checks = m.data_checks;
  return (
    <div>
      <PageHeader
        index="04 · Lithium ML Model"
        title="Predicting lithium concentration from geology"
        lede={`The model learned from ${m.n_samples} real USGS brine samples. Given the rock layers, depth, temperature and location of a spot in southern Arkansas, it estimates how much lithium the brine there holds.`}
      >
        <Badge kind="ml">Trained machine-learning model</Badge>
      </PageHeader>

      <div className="mb-6 rounded-lg border border-line bg-panel p-5">
        <p className="mb-4 max-w-3xl text-sm text-ink-2">
          <strong className="text-ink">How to read these scores.</strong> Each score (called R²) runs from 0 to 1.
          A score of 1 would mean every prediction was exactly right. A score of 0 means the model did no better than
          guessing the average for every well. A score of 0.8 means the model explains 80% of the differences in
          lithium from one well to the next. Every score below comes from wells the model was not allowed to see while learning.
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Test 1 · Random wells hidden" value={test1.r2.toFixed(2)} tone="good"
            sub={rf.random_cv_grouped
              ? `Explains ${pct(test1.r2)}. Repeat samples from one well stay together; mixing them would show ${rf.random_cv.r2.toFixed(2)}`
              : `Explains ${pct(test1.r2)} of the differences between wells`} />
          <Stat label="Test 2 · USGS's own test wells" value={m.usgs_holdout.this_model.r2.toFixed(2)} tone="good"
            sub={`${m.usgs_holdout.n} wells. The U.S. Geological Survey's model scores ${m.usgs_holdout.usgs_model.r2.toFixed(2)} on the same wells${checks ? `. ${checks.usgs_test_wells_sharing_location} of them share a location with a training well, for both models` : ""}`} />
          <Stat label="Test 3 · Whole regions hidden (hardest)" value={`≈${rf.spatial_cv.r2.toFixed(1)}`}
            sub={`Exact score ${rf.spatial_cv.r2.toFixed(3)}. On parts of the map it never saw, it still explains ${pct(rf.spatial_cv.r2)}. Typical miss: about ${num(rf.spatial_cv.mae)} mg/L`} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Why Test 3 is the hardest, and the most honest" kicker="No peeking at the answers">
          <div className="space-y-3 text-sm text-ink-2">
            <p>
              Wells close together usually have similar lithium. If we hide random wells, the model has almost always
              learned from a neighbour, which makes the test easier. So in Test 3 we cut southern Arkansas into
              {" "}{m.n_spatial_blocks} squares about {m.block_size_km} km across, hid whole squares, and asked the model to
              predict them. That is closest to the real use: estimating lithium where nobody has drilled yet.
            </p>
            <p>
              Our model raised the Test 3 score from {m.results.random_forest.spatial_cv.r2.toFixed(2)} (the starting
              random forest) to {rf.spatial_cv.r2.toFixed(2)}. Every method below was tested the same way.
            </p>
            <Table
              head={["Method", "Test 1: random wells", "Test 3: whole regions", "Typical miss (Test 3)"]}
              rows={Object.entries(m.results).map(([k, r]) => [
                <span key={k} className={k === m.chosen_model ? "text-ink" : ""}>{METHOD_NAMES[k] ?? k}</span>,
                <span key="a" className="num">{(r.random_cv_grouped ?? r.random_cv).r2.toFixed(2)}{r.random_cv_grouped ? "*" : ""}</span>,
                <span key="b" className={`num ${k === m.chosen_model ? "text-emerald" : ""}`}>{r.spatial_cv.r2.toFixed(2)}</span>,
                <span key="c" className="num">{num(r.spatial_cv.mae)} mg/L</span>,
              ])}
            />
            {rf.random_cv_grouped && <p className="text-xs text-ink-3">* Our model&rsquo;s Test 1 keeps each well&rsquo;s repeat samples together. The other methods&rsquo; Test 1 scores come from a plain random split, which flatters them a little.</p>}
            <Notice title="What this shows">
              Just copying the nearest wells scores {m.results.idw.random_cv.r2.toFixed(2)} on Test 1, but falls to{" "}
              {m.results.idw.spatial_cv.r2.toFixed(2)} on Test 3, because there are no nearby wells to copy. Our model
              holds {rf.spatial_cv.r2.toFixed(2)}, because it learned from the rock layers, not just from where wells are.
            </Notice>
          </div>
        </Card>

        <Card title="Predicted versus measured lithium" kicker="Test 3: each well predicted by a model that never saw its area">
          <Scatterplot
            points={m.observed_vs_predicted.map((p) => ({ x: p.observed, y: p.predicted, name: p.id }))}
            xLabel="Measured lithium (mg/L)"
            yLabel="Predicted (mg/L)"
            identity
          />
          <p className="text-xs text-ink-3">Dots on the dashed line were predicted exactly right. Dots far from it are wells in areas unlike anywhere else the model learned from.</p>
        </Card>

        {checks && <Card title="Is the data good enough for machine learning?" kicker="Checking the 221 training samples" className="xl:col-span-2">
          <div className="grid gap-6 text-sm text-ink-2 md:grid-cols-2">
            <ul className="data-checks">
              <li className="is-ok">They are the same {checks.n_samples} samples USGS used in its peer-reviewed study (Knierim and others, 2024, <i>Science Advances</i>).</li>
              <li className="is-ok">No lithium values are below the lab&rsquo;s detection limit. Only {checks.missing_depths_filled} sample depths were missing, filled from the geology the same way USGS did.</li>
              <li className="is-ok">Repeat samples agree: samples taken at the same spot differ by a median of {num(checks.repeat_median_spread_mg_l)} mg/L, so the lab measurements are reliable.</li>
            </ul>
            <ul className="data-checks">
              <li className="is-warn">It is small: {checks.n_samples} samples from {checks.n_locations} locations, many from the 1960s and 70s with approximate locations.</li>
              <li className="is-warn">{checks.repeat_samples} samples are repeats from {checks.repeat_locations} locations. Tests 1 and 3 keep a location&rsquo;s samples on one side, so the model can&rsquo;t score well just by recognising a well.</li>
              <li className="is-warn">{checks.smackover_samples} samples come from the Smackover and {checks.other_formation_samples} from shallower layers with much less lithium. The map predicts the Smackover only.</li>
            </ul>
          </div>
          <p className="mt-4 text-sm text-ink"><strong className="font-medium">Verdict:</strong> good enough to show which regions are richer in lithium, which is what USGS used it for. Not enough for exact values at a single well. New, carefully located samples would help most.</p>
        </Card>}

        <Card title="Which clues matter most" kicker="What the model relies on">
          <ResponsiveContainer width="100%" height={m.importance.length * 28 + 30}>
            <BarChart data={m.importance} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis type="number" {...AXIS} />
              <YAxis type="category" dataKey="label" width={200} {...AXIS} tick={{ fill: "#a9b8cc", fontSize: 11 }} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`+${Number(v).toFixed(1)} mg/L error`, "If shuffled"]} />
              <Bar dataKey="mae_increase_mg_l" fill="#74b4f0" barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-ink-3">
            We scrambled one clue at a time and measured how much worse the predictions got. A longer bar means the model leans on that clue more. This shows a link, not proof of cause.
          </p>
        </Card>

        <Card title="Limits of this model" kicker="Read before using the predictions">
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
            <li>It learned from only {m.n_samples} samples. Many are from the 1960s and 70s, and their locations are approximate.</li>
            <li>It is good at showing which regions are richer in lithium, not the exact value at one well. Nine times out of ten, the true value was within ±{num(m.interval.half_width_mg_l)} mg/L of the prediction.</li>
            <li>We tried many model types on these same tests. A brand-new set of wells from a new area would be the real final exam.</li>
            <li>It predicts how much lithium is in the brine. It does not say how much can be pulled out at a profit.</li>
            <li>Model: {METHOD_NAMES[m.chosen_model] ?? m.chosen_model}. Settings were chosen using training wells only.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
