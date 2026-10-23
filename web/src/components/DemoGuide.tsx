"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { brineFromSample, toConditions, useStore } from "@/lib/store";
import { wellLabel } from "@/lib/format";
import type { Conditions } from "@/lib/types";

// The demo well: USGS 2022 sample MW-1 (MSU 3-22, Midway field, Lafayette County). Every input it needs was measured.
const DEMO_WELL = "MW-1";

interface Step {
  path: string;
  title: string;
  body: string;
  action: string;
}

const STEPS: Step[] = [
  {
    path: "/#map",
    title: "Pick a real sampling well",
    body: "Each dot is a brine sample from USGS records. We select MSU 3-22 in the Midway field, sampled by USGS in August 2022.",
    action: "Open the map and select it",
  },
  {
    path: "/#brine",
    title: "Read its brine chemistry",
    body: "Lithium, magnesium, calcium, temperature and pH, each labelled as measured or missing. Magnesium is 60 times the lithium, which matters for extraction.",
    action: "Show the chemistry",
  },
  {
    path: "/#predict",
    title: "Choose a DLE process",
    body: "We start from a simple setup: an aluminum-based (LDH) sorbent at the brine's own temperature and pH, one stage, one hour.",
    action: "Set up the process",
  },
  {
    path: "/#predict",
    title: "Estimate lithium recovery",
    body: "The recovery model uses published sorbent data and chemistry. It is not machine learning, and the page says why. The band shows uncertainty from 500 runs with different plausible assumptions.",
    action: "Run the estimate",
  },
  {
    path: "/#optimize",
    title: "Let the optimizer search",
    body: "The optimizer tests about 9,000 combinations of sorbent, temperature, pH, time, dose and stages, then recommends one for the chosen priority.",
    action: "Run the optimizer",
  },
  {
    path: "/#compare",
    title: "Compare current and recommended",
    body: "Both setups are saved as scenarios and compared on recovery, cost, energy and emissions, with the chance the recommendation really is better.",
    action: "Save and compare",
  },
  {
    path: "/#compare",
    title: "Generate the report",
    body: "A one-page report explains the result and its limitations. It can be printed or saved as PDF, and the numbers exported as CSV.",
    action: "Open the report",
  },
];

export function DemoGuide() {
  const store = useStore();
  const { demoStep, setDemoStep } = store;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (demoStep === null) return null;
  const current = demoStep;
  const step = STEPS[current];

  async function perform() {
    setBusy(true);
    setError(null);
    try {
      const well = store.wells.find((w) => w.id === DEMO_WELL);
      if (!well) throw new Error("Demo well not loaded yet.");
      const brine = brineFromSample(well);
      if (demoStep === 0) { store.selectWell(DEMO_WELL); window.dispatchEvent(new Event("reset-explorer")); }
      if (demoStep === 2 || demoStep === 3) {
        const cond: Conditions = {
          technology: "lial_ldh",
          temperature_c: Math.round(well.temp_c ?? 60),
          ph_target: well.ph ?? 6,
          contact_time_h: 1,
          sorbent_dose_g_l: 10,
          stages: 1,
        };
        store.setConditions(cond);
        if (demoStep === 3) store.setEstimate(await api.estimate(brine, cond, store.flow));
      }
      if (demoStep === 4) {
        store.setOptimization(await api.optimize(brine, store.conditions, "balanced", 0.8));
      }
      if (demoStep === 5) {
        const opt = store.optimization ?? (await api.optimize(brine, store.conditions, "balanced", 0.8));
        store.setOptimization(opt);
        const pick = toConditions;
        const [a, b] = await Promise.all([
          api.estimate(brine, pick(opt.current), store.flow),
          api.estimate(brine, pick(opt.recommended), store.flow),
        ]);
        const base = { wellId: well.id, wellLabel: wellLabel(well), brine, flow_m3_day: store.flow };
        store.saveScenario({ ...base, name: "A · Current setup", conditions: pick(opt.current), estimate: a, origin: "optimizer-current" });
        store.saveScenario({ ...base, name: "B · Optimizer recommendation", conditions: pick(opt.recommended), estimate: b, origin: "optimizer-recommended" });
      }
      window.location.hash = step.path.slice(1);
      const panel = document.querySelector(step.path.slice(1));
      if (panel instanceof HTMLDetailsElement && !panel.open) panel.open = true;
      panel?.scrollIntoView();
      if (current < STEPS.length - 1) setDemoStep(current + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="no-print fixed bottom-16 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-lg border border-emerald/50 bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
      aria-label="Guided demonstration"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="label text-emerald">Guided demo · step {demoStep + 1} of {STEPS.length}</span>
        <button onClick={() => setDemoStep(null)} className="cursor-pointer p-1 text-ink-3 hover:text-ink" aria-label="Close demo">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="mb-1 font-medium">{step.title}</div>
        <p className="text-sm text-ink-2">{step.body}</p>
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={perform}
            disabled={busy}
            className="inline-flex min-h-[38px] flex-1 cursor-pointer items-center justify-center rounded-md bg-emerald px-3 text-sm font-medium text-[#04140c] hover:bg-[#5ce3a1] disabled:opacity-60"
          >
            {busy ? "Working…" : step.action}
          </button>
          <button
            onClick={() => setDemoStep(Math.max(0, demoStep - 1))}
            disabled={demoStep === 0}
            className="min-h-[38px] cursor-pointer rounded-md border border-line-strong px-3 text-sm text-ink-2 disabled:opacity-40"
          >
            Back
          </button>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= demoStep ? "bg-emerald" : "bg-line-strong"}`} />
          ))}
        </div>
      </div>
    </aside>
  );
}
