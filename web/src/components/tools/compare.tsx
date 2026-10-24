"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Notice, PageHeader, Table } from "@/components/ui";
import { useStore } from "@/lib/store";
import { num, pct, smart, TECH_NAMES } from "@/lib/format";
import type { Conditions, MetricKey, Scenario } from "@/lib/types";

const METRICS: { key: MetricKey | "li_t_per_year"; label: string; fmt: (v: number) => string; better: "up" | "down" }[] = [
  { key: "recovery", label: "Lithium recovery", fmt: (v) => pct(v), better: "up" },
  { key: "li_t_per_year", label: "Lithium recovered (t/yr)", fmt: (v) => num(v, 1), better: "up" },
  { key: "cost_usd_per_kg", label: "Operating cost ($/kg Li)", fmt: (v) => `$${smart(v)}`, better: "down" },
  { key: "energy_kwh_per_kg", label: "Energy (kWh/kg Li)", fmt: smart, better: "down" },
  { key: "co2_kg_per_kg", label: "Greenhouse gases (kg CO₂e/kg Li)", fmt: smart, better: "down" },
  { key: "water_m3_per_kg", label: "Fresh water (m³/kg Li)", fmt: smart, better: "down" },
  { key: "naoh_kg_per_kg", label: "Sodium hydroxide (kg/kg Li)", fmt: smart, better: "down" },
  { key: "sludge_kg_per_kg", label: "Hydroxide sludge (kg/kg Li)", fmt: smart, better: "down" },
  { key: "residual_li_mg_l", label: "Lithium left in brine (mg/L)", fmt: (v) => num(v, 1), better: "down" },
];

const COND_LABELS: { key: keyof Conditions; label: string; fmt: (c: Conditions) => string }[] = [
  { key: "technology", label: "Technology", fmt: (c) => TECH_NAMES[c.technology] },
  { key: "temperature_c", label: "Temperature", fmt: (c) => `${c.temperature_c} °C` },
  { key: "ph_target", label: "Target pH", fmt: (c) => c.ph_target.toFixed(1) },
  { key: "contact_time_h", label: "Contact time", fmt: (c) => `${c.contact_time_h} h` },
  { key: "sorbent_dose_g_l", label: "Sorbent dose", fmt: (c) => `${c.sorbent_dose_g_l} g/L` },
  { key: "stages", label: "Stages", fmt: (c) => String(c.stages) },
];

function value(s: Scenario, key: MetricKey | "li_t_per_year") {
  return key === "li_t_per_year" ? s.estimate.central.li_t_per_year : s.estimate.central[key];
}
function band(s: Scenario, key: MetricKey | "li_t_per_year") {
  return s.estimate.uncertainty[key];
}

/** Plain-language summary of what changed between A and B and what that did. */
function explain(a: Scenario, b: Scenario) {
  const lines: string[] = [];
  const changed = COND_LABELS.filter((c) => a.conditions[c.key] !== b.conditions[c.key]);
  if (a.wellId !== b.wellId) lines.push(`The scenarios use different brines: ${a.wellLabel} and ${b.wellLabel}.`);
  if (changed.length) lines.push(`B changes ${changed.map((c) => `${c.label} (${c.fmt(a.conditions)} → ${c.fmt(b.conditions)})`).join(", ")}.`);
  const dr = b.estimate.central.recovery - a.estimate.central.recovery;
  lines.push(`Recovery ${dr >= 0 ? "rises" : "falls"} by ${Math.abs(dr * 100).toFixed(1)} percentage points, from ${pct(a.estimate.central.recovery)} to ${pct(b.estimate.central.recovery)}.`);
  const dc = b.estimate.central.cost_usd_per_kg - a.estimate.central.cost_usd_per_kg;
  lines.push(`Operating cost per kg of lithium ${dc >= 0 ? "rises" : "falls"} from $${smart(a.estimate.central.cost_usd_per_kg)} to $${smart(b.estimate.central.cost_usd_per_kg)}.`);
  if (b.estimate.central.naoh_kg_per_kg > a.estimate.central.naoh_kg_per_kg + 1)
    lines.push(`B raises the brine's pH, which uses ${smart(b.estimate.central.naoh_kg_per_kg)} kg of sodium hydroxide per kg of lithium and creates ${smart(b.estimate.central.sludge_kg_per_kg)} kg of hydroxide sludge.`);
  if (b.estimate.central.heat_kwh_per_kg > a.estimate.central.heat_kwh_per_kg + 1)
    lines.push(`B heats the brine, adding ${smart(b.estimate.central.heat_kwh_per_kg - a.estimate.central.heat_kwh_per_kg)} kWh of heat per kg of lithium.`);
  const overlap = band(b, "recovery").p5 <= band(a, "recovery").p95 && band(a, "recovery").p5 <= band(b, "recovery").p95;
  lines.push(overlap
    ? "The two recovery uncertainty bands overlap, so the difference is not certain under the model's assumptions."
    : "The recovery uncertainty bands do not overlap, so under the model's assumptions the difference is robust.");
  return lines;
}

function toCsv(list: Scenario[]) {
  const header = ["scenario", "well", "technology", "temperature_c", "ph_target", "contact_time_h", "sorbent_dose_g_l", "stages", "flow_m3_day",
    ...METRICS.flatMap((m) => [`${m.key}`, `${m.key}_p5`, `${m.key}_p95`]), "assumed_inputs", "model"];
  const rows = list.map((s) => [
    s.name, s.wellLabel, s.conditions.technology, s.conditions.temperature_c, s.conditions.ph_target, s.conditions.contact_time_h,
    s.conditions.sorbent_dose_g_l, s.conditions.stages, s.flow_m3_day,
    ...METRICS.flatMap((m) => [value(s, m.key), band(s, m.key).p5, band(s, m.key).p95]),
    s.estimate.assumed_inputs.join(" "), "literature-based process model (not ML)",
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function ComparePage() {
  const { scenarios, removeScenario } = useStore();
  // Until the user chooses, A and B default to the latest optimizer pair (or the first and last saved).
  const [aChoice, setAId] = useState("");
  const [bChoice, setBId] = useState("");
  const latest = (origin: Scenario["origin"]) => [...scenarios].reverse().find((s) => s.origin === origin)?.id;
  const aId = scenarios.some((s) => s.id === aChoice) ? aChoice : latest("optimizer-current") ?? scenarios[0]?.id ?? "";
  const bId = scenarios.some((s) => s.id === bChoice) ? bChoice : latest("optimizer-recommended") ?? scenarios[scenarios.length - 1]?.id ?? "";

  useEffect(() => {
    if (window.location.hash === "#report") document.getElementById("report")?.scrollIntoView({ behavior: "smooth" });
  }, [aId, bId]);

  const a = scenarios.find((s) => s.id === aId);
  const b = scenarios.find((s) => s.id === bId);
  const reasons = useMemo(() => (a && b ? explain(a, b) : []), [a, b]);

  function download() {
    const blob = new Blob([toCsv(scenarios)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lithium-lens-scenarios.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!scenarios.length) {
    return (
      <div>
        <PageHeader index="08 · Scenario Comparison" title="Which option works better?" lede="Save two options to compare how much lithium they recover and what they use." />
        <Notice>
          Your comparison starts with two setups. <a href="#predict" className="underline">Calculate and save a recovery estimate</a>, change a setting, then save another. Return here to see the differences side by side.
        </Notice>
      </div>
    );
  }

  return (
    <div>
      <PageHeader index="08 · Scenario Comparison" title="Which option works better?" lede="Compare the benefits and trade-offs. These are research estimates, not guaranteed results.">
        <div className="no-print flex gap-2">
          <Button variant="secondary" onClick={download}>Export CSV</Button>
          <Button onClick={() => window.print()}>Print / save PDF</Button>
        </div>
      </PageHeader>

      <div className="no-print mb-6 grid gap-4 md:grid-cols-2">
        {[
          { label: "Option A", id: aId, set: setAId },
          { label: "Option B", id: bId, set: setBId },
        ].map((s) => (
          <label key={s.label} className="flex flex-col gap-1 text-sm">
            <span className="text-ink-2">{s.label}</span>
            <select value={s.id} onChange={(e) => s.set(e.target.value)} className="min-h-[40px]">
              {scenarios.map((sc) => <option key={sc.id} value={sc.id}>{sc.name} · {sc.wellLabel}</option>)}
            </select>
          </label>
        ))}
      </div>

      {a && b && (
        <div id="report" className="print-area flex flex-col gap-6">
          {a.id === b.id ? <Notice>You’re viewing the same option twice. <a href="#predict" className="underline">Save a different option</a> to see a meaningful comparison.</Notice> : <>
            <section aria-label="Comparison summary">
              <h3 className="text-xl font-semibold">What this means</h3>
              <p className="mt-2 text-ink-2">{Math.abs(b.estimate.central.recovery - a.estimate.central.recovery) < 0.0005 ? "Both options recover about the same share of lithium." : `Option ${b.estimate.central.recovery > a.estimate.central.recovery ? "B" : "A"} recovers more lithium.`} {Math.abs(b.estimate.central.cost_usd_per_kg - a.estimate.central.cost_usd_per_kg) < 0.005 ? "Their estimated operating costs are about the same." : `Option ${b.estimate.central.cost_usd_per_kg < a.estimate.central.cost_usd_per_kg ? "B" : "A"} costs less per kilogram recovered.`}</p>
              <p className="mt-2 text-sm text-ink-3">{a.wellId !== b.wellId ? "These options use different samples, so both the location and the setup affect the results. " : ""}A higher recovery does not always mean lower cost or less water use.</p>
            </section>
            <Table head={["For each option", "Option A", "Option B"]} rows={[
              ["Share of lithium recovered", pct(a.estimate.central.recovery), pct(b.estimate.central.recovery)],
              ["Operating cost per kilogram recovered (energy, chemicals, sorbent)", `$${smart(a.estimate.central.cost_usd_per_kg)}`, `$${smart(b.estimate.central.cost_usd_per_kg)}`],
              ["Fresh water per kilogram recovered (litres)", num(a.estimate.central.water_m3_per_kg * 1000), num(b.estimate.central.water_m3_per_kg * 1000)],
              ["Electricity-equivalent energy per kilogram (kWh)", smart(a.estimate.central.energy_kwh_per_kg), smart(b.estimate.central.energy_kwh_per_kg)],
            ]} />
          </>}
          <p className="text-sm text-ink-3">Actual results may differ. Costs exclude equipment, labour, and refining. These estimates need testing before use in a real project.</p>
          <details className="inline-details"><summary>Technical report & assumptions <span>+</span></summary><div className="advanced-controls flex flex-col gap-6">
          <Card title="Lithium Lens · scenario report" kicker={`Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="label mb-2">Brine</div>
                <p className="text-sm text-ink-2">
                  A: <span className="text-ink">{a.wellLabel}</span> · Li {num(a.brine.li, 1)}, Mg {num(a.brine.mg)}, Ca {num(a.brine.ca)} mg/L{" "}
                  <Badge kind="measured" />
                </p>
                {a.wellId !== b.wellId && (
                  <p className="mt-1 text-sm text-ink-2">
                    B: <span className="text-ink">{b.wellLabel}</span> · Li {num(b.brine.li, 1)}, Mg {num(b.brine.mg)}, Ca {num(b.brine.ca)} mg/L
                  </p>
                )}
                {[...new Set([...a.estimate.assumed_inputs, ...b.estimate.assumed_inputs])].length > 0 && (
                  <p className="mt-1 text-xs text-amber">Assumed because not measured: {[...new Set([...a.estimate.assumed_inputs, ...b.estimate.assumed_inputs])].join(", ")}.</p>
                )}
              </div>
              <div>
                <div className="label mb-2">Setups</div>
                <Table
                  head={["", a.name, b.name]}
                  rows={COND_LABELS.map((c) => [c.label, c.fmt(a.conditions), <span key="b" className={a.conditions[c.key] !== b.conditions[c.key] ? "text-emerald" : ""}>{c.fmt(b.conditions)}</span>])}
                />
              </div>
            </div>
          </Card>

          <Card title="Results" kicker="Central estimate, with 5th–95th percentile from 500 runs">
            <Table
              head={["Measure", a.name, b.name]}
              rows={METRICS.map((m) => {
                const va = value(a, m.key);
                const vb = value(b, m.key);
                const better = m.better === "up" ? vb > va : vb < va;
                return [
                  m.label,
                  <span key="a" className="num text-ink">{m.fmt(va)} <span className="text-xs text-ink-3">({m.fmt(band(a, m.key).p5)}–{m.fmt(band(a, m.key).p95)})</span></span>,
                  <span key="b" className={`num ${Math.abs(vb - va) < 1e-9 ? "text-ink" : better ? "text-emerald" : "text-amber"}`}>
                    {m.fmt(vb)} <span className="text-xs text-ink-3">({m.fmt(band(b, m.key).p5)}–{m.fmt(band(b, m.key).p95)})</span>
                  </span>,
                ];
              })}
            />
          </Card>

          <Card title="What changed and why it matters">
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>

          <Card title="Limitations">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              <li>Recovery comes from a literature-based chemistry model, not from experiments on this brine and not from machine learning.</li>
              <li>Many model parameters are stated assumptions; the uncertainty band reflects their ranges, not every possible error.</li>
              <li>Costs include energy, chemicals and sorbent only: no equipment, labour, or refining to battery-grade product.</li>
              <li>Brine chemistry is measured but sampling dates vary; historical samples may not reflect today&apos;s brine.</li>
              <li>No setup here is shown to be industrially optimal. Laboratory and pilot testing would be required.</li>
            </ul>
            <p className="mt-3 text-xs text-ink-3">Data: USGS (Knierim and others, 2024, doi:10.5066/P9QPRYZN; Produced Waters Geochemical Database v3.0, doi:10.5066/P9DSRCZJ). Full sources at /methodology.</p>
          </Card>
          </div></details>
        </div>
      )}

      <div className="no-print mt-8">
        <details className="inline-details"><summary>Manage saved options <span>+</span></summary><div className="advanced-controls">
          <Table
            head={["Name", "Brine", "Recovery", "$/kg Li", "Saved", ""]}
            rows={scenarios.map((s) => [
              s.name,
              s.wellLabel,
              <span key="r" className="num">{pct(s.estimate.central.recovery)}</span>,
              <span key="c" className="num">${smart(s.estimate.central.cost_usd_per_kg)}</span>,
              new Date(s.savedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }),
              <button key="d" onClick={() => removeScenario(s.id)} className="cursor-pointer text-xs text-ink-3 underline hover:text-red">Delete</button>,
            ])}
          />
        </div></details>
      </div>
    </div>
  );
}
