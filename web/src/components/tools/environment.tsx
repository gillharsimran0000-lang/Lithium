"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Notice, PageHeader, Spinner, Table } from "@/components/ui";
import { PairBars } from "@/components/charts";
import { brineFromSample, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { num, smart, TECH_NAMES, wellLabel } from "@/lib/format";
import type { Estimate, MetricKey } from "@/lib/types";

const ROWS: { key: MetricKey; label: string; unit: string; basis: string }[] = [
  { key: "electricity_kwh_per_kg", label: "Electricity", unit: "kWh/kg Li", basis: "Pumping, reinjection and sorption stages (based on South West Arkansas feasibility study pump ratings)" },
  { key: "heat_kwh_per_kg", label: "Heat", unit: "kWh/kg Li", basis: "Brine density (measured) × heat capacity × temperature rise, after heat recovery" },
  { key: "co2_kg_per_kg", label: "Greenhouse gases", unit: "kg CO₂e/kg Li", basis: "Arkansas grid (EPA eGRID2023), natural gas (EPA), chemicals (Euro Chlor, BAFA and ADEME factors)" },
  { key: "water_m3_per_kg", label: "Fresh water", unit: "m³/kg Li", basis: "Eluate and wash volumes (based on published eluate strengths)" },
  { key: "brine_m3_per_kg", label: "Brine handled", unit: "m³/kg Li", basis: "Lithium in brine (measured) ÷ recovery. Assumed reinjected, not consumed" },
  { key: "naoh_kg_per_kg", label: "Sodium hydroxide", unit: "kg/kg Li", basis: "Hydroxide chemistry and solubility products" },
  { key: "hcl_kg_per_kg", label: "Hydrochloric acid", unit: "kg/kg Li", basis: "Acid to strip lithium from ion sieves (excess based on lab elutions)" },
  { key: "sludge_kg_per_kg", label: "Hydroxide sludge (waste)", unit: "kg/kg Li", basis: "Mg(OH)₂ and Ca(OH)₂ precipitated when pH is raised" },
  { key: "sorbent_kg_per_kg", label: "Spent sorbent (waste)", unit: "kg/kg Li", basis: "Sorbent lost per cycle (published or assumed)" },
  { key: "residual_li_mg_l", label: "Lithium left in spent brine", unit: "mg/L", basis: "Returned underground with the brine" },
];

interface Choice {
  id: string;
  label: string;
  estimate: Estimate | null;
}

export default function EnvironmentPage() {
  const { well, conditions, flow, estimate, setEstimate, scenarios } = useStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!well || estimate) return;
    api.estimate(brineFromSample(well), conditions, flow).then(setEstimate).catch((e) => setError(String(e.message ?? e)));
  }, [well, conditions, flow, estimate, setEstimate]);

  const choices: Choice[] = useMemo(
    () => [
      { id: "live", label: `Current setup (${TECH_NAMES[conditions.technology]})`, estimate },
      ...scenarios.map((s) => ({ id: s.id, label: `${s.name} · ${s.wellLabel}`, estimate: s.estimate })),
    ],
    [scenarios, estimate, conditions.technology],
  );
  const [aId, setAId] = useState("live");
  // B defaults to the latest optimizer recommendation until the user picks something else.
  const [bChoice, setBId] = useState<string | null>(null);
  const bId = bChoice ?? [...scenarios].reverse().find((s) => s.origin === "optimizer-recommended")?.id ?? "";

  const a = choices.find((c) => c.id === aId)?.estimate ?? null;
  const b = choices.find((c) => c.id === bId)?.estimate ?? null;
  const nameA = choices.find((c) => c.id === aId)?.label ?? "A";
  const nameB = choices.find((c) => c.id === bId)?.label ?? "B";

  const yearly = (e: Estimate) => {
    const kgYear = e.central.li_t_per_year * 1000;
    return {
      co2: (e.central.co2_kg_per_kg * kgYear) / 1000,
      water: e.central.water_m3_per_kg * kgYear,
      naoh: (e.central.naoh_kg_per_kg * kgYear) / 1000,
    };
  };

  return (
    <div>
      <PageHeader
        index="07 · Environmental Impact"
        title="What each kilogram of lithium costs the environment"
        lede="Energy, water, chemicals, emissions and waste for an extraction setup, per kilogram of lithium recovered. Compare two setups side by side."
      >
        <Badge kind="model">Calculated, not measured</Badge>
      </PageHeader>

      <Notice tone="warn" title="What is and is not counted">
        Counted: lifting and reinjecting brine, the DLE step, heating, pH adjustment, acid stripping and sorbent loss.
        Not counted: drilling and building the plant, turning the lithium chloride solution into battery-grade lithium
        carbonate or hydroxide, transport. A 2023 review (Vera and others, <em>Nature Reviews Earth &amp; Environment</em>)
        recommends counting the full chain, so these numbers understate the full footprint.
      </Notice>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          { label: "Scenario A", id: aId, set: setAId },
          { label: "Scenario B", id: bId, set: setBId },
        ].map((s) => (
          <label key={s.label} className="flex flex-col gap-1 text-sm">
            <span className="text-ink-2">{s.label}</span>
            <select value={s.id} onChange={(e) => s.set(e.target.value)} className="min-h-[40px]">
              {s.label === "Scenario B" && <option value="">None</option>}
              {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      {scenarios.length === 0 && (
        <p className="mt-2 text-xs text-ink-3">
          Save scenarios on the <a href="#predict" className="underline">Recovery Predictor</a> or{" "}
          <a href="#optimize" className="underline">Optimizer</a> to compare them here.
        </p>
      )}

      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
      {!a ? (
        <div className="mt-6"><Spinner label="Calculating" /></div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card title="Per kilogram of lithium recovered" kicker={well ? wellLabel(well) : undefined}>
            <Table
              head={["Measure", "A", ...(b ? ["B"] : []), "How it is calculated"]}
              rows={ROWS.map((r) => [
                <span key="l" className="text-ink">{r.label}<span className="block text-xs text-ink-3">{r.unit}</span></span>,
                <span key="a" className="num text-ink">{smart(a.central[r.key])}<span className="block text-xs text-ink-3">{smart(a.uncertainty[r.key].p5)}–{smart(a.uncertainty[r.key].p95)}</span></span>,
                ...(b ? [<span key="b" className="num text-ink">{smart(b.central[r.key])}<span className="block text-xs text-ink-3">{smart(b.uncertainty[r.key].p5)}–{smart(b.uncertainty[r.key].p95)}</span></span>] : []),
                <span key="h" className="text-xs">{r.basis}</span>,
              ])}
            />
            <p className="mt-2 text-xs text-ink-3">Small numbers under each value: 5th–95th percentile across 500 runs with varied assumptions.</p>
          </Card>

          <div className="flex flex-col gap-6">
            {b && (
              <Card title="A versus B" kicker="Per kg of lithium">
                <PairBars
                  names={[nameA, nameB]}
                  data={[
                    { metric: "Energy (kWh)", a: a.central.energy_kwh_per_kg, b: b.central.energy_kwh_per_kg },
                    { metric: "CO₂e (kg)", a: a.central.co2_kg_per_kg, b: b.central.co2_kg_per_kg },
                    { metric: "NaOH (kg)", a: a.central.naoh_kg_per_kg, b: b.central.naoh_kg_per_kg },
                    { metric: "Sludge (kg)", a: a.central.sludge_kg_per_kg, b: b.central.sludge_kg_per_kg },
                    { metric: "Fresh water (m³)", a: a.central.water_m3_per_kg, b: b.central.water_m3_per_kg },
                  ]}
                />
                <div className="mt-2 flex gap-4 text-xs text-ink-3">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-sky" />A</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald" />B</span>
                </div>
              </Card>
            )}
            <Card title="Per year at the chosen brine flow" kicker={`${num(flow)} m³ of brine per day`}>
              <Table
                head={["", "A", ...(b ? ["B"] : [])]}
                rows={[
                  ["Lithium recovered (t)", num(a.central.li_t_per_year, 1), ...(b ? [num(b.central.li_t_per_year, 1)] : [])],
                  ["CO₂e (t)", num(yearly(a).co2), ...(b ? [num(yearly(b).co2)] : [])],
                  ["Fresh water (m³)", num(yearly(a).water), ...(b ? [num(yearly(b).water)] : [])],
                  ["Sodium hydroxide (t)", num(yearly(a).naoh), ...(b ? [num(yearly(b).naoh)] : [])],
                ]}
              />
              <p className="mt-2 text-xs text-ink-3">Saved scenarios keep the flow they were saved with.</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
