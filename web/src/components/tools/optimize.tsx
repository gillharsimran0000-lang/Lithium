"use client";

import { useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Badge, Button, Card, Notice, PageHeader, Slider, Spinner, Table } from "@/components/ui";
import { WellPicker } from "@/components/WellPicker";
import { AXIS, GRID, TOOLTIP } from "@/components/charts";
import { brineFromSample, toConditions, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { num, pct, smart, TECH_COLORS, TECH_NAMES, TECH_SHORT, wellLabel } from "@/lib/format";
import type { Optimization, Option, Priority, Technology } from "@/lib/types";

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "balanced", label: "Balance everything" },
  { key: "recovery", label: "Maximize recovery" },
  { key: "cost", label: "Minimize cost" },
  { key: "energy", label: "Minimize energy" },
];

const COMPARE_WELL = "BR-4"; // hot, lithium-rich USGS 2022 sample used for the two-well comparison

function setupRows(o: Option) {
  return [
    ["Technology", TECH_NAMES[o.technology]],
    ["Temperature", `${num(o.temperature_c)} °C`],
    ["Target pH", o.ph_target.toFixed(1)],
    ["Contact time", `${o.contact_time_h} h`],
    ["Sorbent dose", `${o.sorbent_dose_g_l} g/L`],
    ["Stages", String(o.stages)],
  ];
}

const METRICS: { key: keyof Option; label: string; fmt: (v: number) => string; better: "up" | "down" }[] = [
  { key: "recovery", label: "Lithium recovery", fmt: (v) => pct(v), better: "up" },
  { key: "cost_usd_per_kg", label: "Operating cost ($/kg Li)", fmt: (v) => `$${smart(v)}`, better: "down" },
  { key: "energy_kwh_per_kg", label: "Energy (kWh/kg Li)", fmt: smart, better: "down" },
  { key: "co2_kg_per_kg", label: "CO₂e (kg/kg Li)", fmt: smart, better: "down" },
  { key: "naoh_kg_per_kg", label: "Sodium hydroxide (kg/kg Li)", fmt: smart, better: "down" },
  { key: "water_m3_per_kg", label: "Fresh water (m³/kg Li)", fmt: smart, better: "down" },
];

function CompareTable({ a, b, names }: { a: Option; b: Option; names: [string, string] }) {
  const setupA = setupRows(a);
  const setupB = setupRows(b);
  return (
    <Table
      head={["", names[0], names[1]]}
      rows={[
        ...setupA.map((r, i) => [r[0], r[1], <span key="b" className={r[1] !== setupB[i][1] ? "text-emerald" : ""}>{setupB[i][1]}</span>]),
        ...METRICS.map((m) => {
          const va = a[m.key] as number;
          const vb = b[m.key] as number;
          const improved = m.better === "up" ? vb > va + 1e-9 : vb < va - 1e-9;
          return [m.label, <span key="a" className="num">{m.fmt(va)}</span>, <span key="b" className={`num ${improved ? "text-emerald" : vb === va ? "" : "text-amber"}`}>{m.fmt(vb)}</span>];
        }),
      ]}
    />
  );
}

export default function OptimizePage() {
  const store = useStore();
  const { well, conditions, optimization, setOptimization, wells, flow, saveScenario } = store;
  const [priority, setPriority] = useState<Priority>(optimization?.priority ?? "balanced");
  const [minRecovery, setMinRecovery] = useState(0.8);
  const [techs, setTechs] = useState<Technology[]>(["lial_ldh", "lmo", "hto"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [otherId, setOtherId] = useState(COMPARE_WELL);
  const [pair, setPair] = useState<[Optimization, Optimization] | null>(null);
  const [pairBusy, setPairBusy] = useState(false);

  async function run() {
    if (!well) return;
    setBusy(true);
    setError(null);
    try {
      setOptimization(await api.optimize(brineFromSample(well), conditions, priority, minRecovery, techs));
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runPair() {
    const other = wells.find((w) => w.id === otherId);
    if (!well || !other) return;
    setPairBusy(true);
    setError(null);
    try {
      const results = await Promise.all(
        [well, other].map((w) =>
          api.optimize(brineFromSample(w), { ...conditions, temperature_c: Math.min(95, Math.max(20, Math.round(w.temp_c ?? 60))), ph_target: w.ph ?? 6 }, priority, minRecovery, techs),
        ),
      );
      setPair([results[0], results[1]]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPairBusy(false);
    }
  }

  async function saveBoth() {
    if (!well || !optimization?.feasible) return;
    const brine = brineFromSample(well);
    const [a, b] = await Promise.all([
      api.estimate(brine, toConditions(optimization.current), flow),
      api.estimate(brine, toConditions(optimization.recommended), flow),
    ]);
    const base = { wellId: well.id, wellLabel: wellLabel(well), brine, flow_m3_day: flow };
    saveScenario({ ...base, name: "A · Current setup", conditions: toConditions(optimization.current), estimate: a, origin: "optimizer-current" });
    saveScenario({ ...base, name: `B · Optimizer (${optimization.priority_label.toLowerCase()})`, conditions: toConditions(optimization.recommended), estimate: b, origin: "optimizer-recommended" });
    setSaved(true);
  }

  const o = optimization;
  const other = wells.find((w) => w.id === otherId);

  return (
    <div>
      <PageHeader
        index="06 · Extraction Optimizer"
        title="Search for better operating conditions"
        lede="The optimizer runs every combination of sorbent, temperature, pH, contact time, sorbent dose and number of stages through the recovery model, then picks the best one for your priority."
      >
        <Badge kind="model">Searches the literature-based model</Badge>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card title="Search settings">
          <div className="flex flex-col gap-5">
            <WellPicker />
            <fieldset>
              <legend className="mb-2 text-sm text-ink-2">Priority</legend>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPriority(p.key)}
                    aria-pressed={priority === p.key}
                    className={`min-h-[40px] cursor-pointer rounded-md border px-2 text-sm transition-colors duration-150 ${
                      priority === p.key ? "border-emerald/70 bg-emerald/10 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {priority === "balanced" && (
                <p className="mt-2 text-xs text-ink-3">Weights: recovery 40%; cost, energy and CO₂e 20% each. Each is scaled 0–1 across the options that qualify.</p>
              )}
            </fieldset>
            {priority !== "recovery" && (
              <Slider label="Minimum recovery" unit="%" min={30} max={95} step={5} value={Math.round(minRecovery * 100)} onChange={(v) => setMinRecovery(v / 100)}
                hint="Options below this are not considered." />
            )}
            <fieldset>
              <legend className="mb-2 text-sm text-ink-2">Technologies to consider</legend>
              {(["lial_ldh", "lmo", "hto"] as Technology[]).map((t) => (
                <label key={t} className="flex min-h-[32px] items-center gap-2 text-sm text-ink-2">
                  <input
                    type="checkbox"
                    className="accent-[var(--emerald)]"
                    checked={techs.includes(t)}
                    onChange={(e) => setTechs(e.target.checked ? [...techs, t] : techs.filter((x) => x !== t))}
                  />
                  {TECH_NAMES[t]}
                </label>
              ))}
            </fieldset>
            <div className="text-xs text-ink-3">
              Current setup comes from the <a href="#predict" className="underline">Recovery Predictor</a>: {TECH_NAMES[conditions.technology]}, {conditions.temperature_c} °C, pH {conditions.ph_target}, {conditions.contact_time_h} h, {conditions.sorbent_dose_g_l} g/L, {conditions.stages} stage(s).
            </div>
            <Button onClick={run} disabled={busy || !techs.length}>{busy ? "Searching…" : "Run optimizer"}</Button>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {error && <Notice tone="error" title="The optimizer could not run">{error}</Notice>}
          {busy && <Spinner label="Testing about 9,000 setups" />}
          {!o && !busy && <Notice>Choose a priority and run the optimizer.</Notice>}
          {o && !o.feasible && <Notice tone="warn" title="No setup qualifies">{o.message}</Notice>}
          {o && o.feasible && (
            <>
              <Card
                title="Current versus recommended"
                kicker={`${num(o.n_evaluated)} setups tested · ${num(o.n_feasible)} met the constraints`}
                actions={<Button variant="secondary" onClick={saveBoth} disabled={saved}>{saved ? "Saved to comparison" : "Save both as scenarios"}</Button>}
              >
                <CompareTable a={o.current} b={o.recommended} names={["Current", "Recommended"]} />
                <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-3">
                  <div>
                    <div className="label">Chance of higher recovery</div>
                    <div className="num text-2xl">{pct(o.uncertainty.p_higher_recovery, 0)}</div>
                    <div className="text-xs text-ink-3">of {o.uncertainty.n_samples} paired runs with varied assumptions</div>
                  </div>
                  <div>
                    <div className="label">Recovery gain, 90% range</div>
                    <div className="num text-2xl">{(o.uncertainty.recovery_gain_p5 * 100).toFixed(0)} to {(o.uncertainty.recovery_gain_p95 * 100).toFixed(0)} pts</div>
                  </div>
                  <div>
                    <div className="label">Chance of lower cost</div>
                    <div className="num text-2xl">{pct(o.uncertainty.p_lower_cost, 0)}</div>
                  </div>
                </div>
              </Card>

              <Card title="Why the recommendation differs" kicker="Generated from the model's own numbers">
                <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
                  {o.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <p className="mt-3 text-xs text-amber">{o.caveat}</p>
              </Card>

              <Card title="Every setup tested: cost against recovery" kicker="Each dot is one setup · line shows the best trade-offs">
                <ResponsiveContainer width="100%" height={340}>
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis type="number" dataKey="recovery" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...AXIS}
                      label={{ value: "Lithium recovery", position: "insideBottom", offset: -14, fill: "#8194ad", fontSize: 11 }} />
                    <YAxis type="number" dataKey="cost_usd_per_kg" scale="log" domain={["auto", "auto"]} allowDataOverflow {...AXIS}
                      tickFormatter={(v) => `$${v}`} label={{ value: "$ per kg Li (log)", angle: -90, position: "insideLeft", offset: 14, fill: "#8194ad", fontSize: 11 }} />
                    <ZAxis range={[10, 10]} />
                    <Tooltip {...TOOLTIP} formatter={(v, n) => [n === "recovery" ? pct(Number(v)) : `$${smart(Number(v))}`, n === "recovery" ? "Recovery" : "Cost per kg"]} />
                    {(Object.keys(TECH_NAMES) as Technology[]).map((t) => (
                      <Scatter key={t} name={TECH_SHORT[t]} data={o.cloud.filter((c) => c.technology === t && c.cost_usd_per_kg < 1e4)} fill={TECH_COLORS[t]} fillOpacity={0.35} isAnimationActive={false} />
                    ))}
                    <Scatter name="Best trade-offs" data={o.pareto} fill="none" line={{ stroke: "#e4ebf4", strokeWidth: 1.5 }} isAnimationActive={false} />
                    <Scatter name="Current" data={[o.current]} fill="#f07272" shape="diamond" isAnimationActive={false} />
                    <Scatter name="Recommended" data={[o.recommended]} fill="#ffffff" shape="star" isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                  {(Object.keys(TECH_NAMES) as Technology[]).map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TECH_COLORS[t] }} />
                      {TECH_NAMES[t]}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ink" />Best trade-offs</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-red" />Current</span>
                  <span className="flex items-center gap-1.5"><span className="text-ink">★</span>Recommended</span>
                </div>
              </Card>

              <Card title="Best option for each technology">
                <Table
                  head={["Technology", "Setup", "Recovery", "$/kg Li", "kWh/kg", "NaOH kg/kg"]}
                  rows={Object.entries(o.best_by_technology).map(([t, b]) => [
                    TECH_NAMES[t as Technology],
                    <span key="s" className="num text-xs">{b!.temperature_c}°C · pH {b!.ph_target.toFixed(1)} · {b!.contact_time_h} h · {b!.sorbent_dose_g_l} g/L · {b!.stages}×</span>,
                    <span key="r" className="num">{pct(b!.recovery)}</span>,
                    <span key="c" className="num">${smart(b!.cost_usd_per_kg)}</span>,
                    <span key="e" className="num">{smart(b!.energy_kwh_per_kg)}</span>,
                    <span key="n" className="num">{smart(b!.naoh_kg_per_kg)}</span>,
                  ])}
                />
              </Card>
            </>
          )}

          <Card title="Same priority, two different brines" kicker="Does the best setup depend on the brine?">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <WellPicker label="Compare the selected brine with" value={otherId} onChange={setOtherId} />
              </div>
              <Button variant="secondary" onClick={runPair} disabled={pairBusy || !other}>{pairBusy ? "Searching…" : "Optimize both"}</Button>
            </div>
            {pair && pair[0].feasible && pair[1].feasible && well && other && (
              <div className="mt-5">
                <CompareTable a={pair[0].recommended} b={pair[1].recommended} names={[wellLabel(well), wellLabel(other)]} />
                <p className="mt-3 text-sm text-ink-2">
                  {wellLabel(well)}: {num(well.chemistry.Li.value, 1)} mg/L lithium, Mg/Li {num(well.chemistry.Mg.value! / well.chemistry.Li.value!)}, {num(well.temp_c ?? 60)} °C.{" "}
                  {wellLabel(other)}: {num(other.chemistry.Li.value, 1)} mg/L lithium, Mg/Li {num(other.chemistry.Mg.value! / other.chemistry.Li.value!)}, {num(other.temp_c ?? 60)} °C.
                  {" "}Green values in the second column differ from the first brine&apos;s recommendation. Differences come only from each brine&apos;s measured chemistry and temperature.
                </p>
              </div>
            )}
            {pair && (!pair[0].feasible || !pair[1].feasible) && <Notice tone="warn">One of the brines had no setup meeting the minimum recovery.</Notice>}
          </Card>
        </div>
      </div>
    </div>
  );
}
