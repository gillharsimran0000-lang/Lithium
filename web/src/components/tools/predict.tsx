"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Notice, PageHeader, Slider, Spinner, Stat } from "@/components/ui";
import { ConditionsForm } from "@/components/ConditionsForm";
import { WellPicker } from "@/components/WellPicker";
import { SweepChart, Tornado } from "@/components/charts";
import { brineFromSample, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { num, pct, smart, TECH_NAMES, wellLabel } from "@/lib/format";

const ASSUMED_LABEL: Record<string, string> = {
  temp_c: "brine temperature (60 °C assumed)",
  ph: "brine pH (6.0 assumed)",
  specific_gravity: "brine density (specific gravity 1.15 assumed)",
};

export default function PredictPage() {
  const { well, conditions, setConditions, flow, setFlow, estimate, setEstimate, saveScenario } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-run the model shortly after the user stops moving a slider.
  useEffect(() => {
    if (!well) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setEstimate(await api.estimate(brineFromSample(well), conditions, flow));
        setSaved(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [well, conditions, flow, setEstimate]);

  const e = estimate;
  const u = e?.uncertainty;

  function save() {
    if (!well || !e) return;
    saveScenario({
      name: `${TECH_NAMES[conditions.technology]} · ${conditions.temperature_c} °C · pH ${conditions.ph_target}`,
      wellId: well.id,
      wellLabel: wellLabel(well),
      brine: brineFromSample(well),
      conditions,
      flow_m3_day: flow,
      estimate: e,
      origin: "manual",
    });
    setSaved(true);
  }

  return (
    <div>
      <PageHeader
        index="05 · Recovery Predictor & Simulator"
        title="How much lithium would this setup recover?"
        lede="Move the sliders to change the extraction conditions. Recovery, cost and energy update from a chemistry model of three DLE sorbents."
      >
        <Badge kind="model">Literature-based model, not machine learning</Badge>
      </PageHeader>

      <Notice tone="warn" title="Why this is not a machine-learning prediction">
        A trustworthy ML model of recovery needs hundreds of DLE experiments on real brines, recorded consistently. We
        found no public dataset like that (a 2023 review in <em>Nature Reviews Earth &amp; Environment</em> notes only
        about 30% of DLE tests even used real brine). So recovery is calculated from chemistry: a competitive adsorption
        isotherm, a mass balance, reaction kinetics and hydroxide solubility, with parameters from published studies or
        stated assumptions. See <a href="#methodology" className="underline">Methodology</a>.
      </Notice>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="Inputs">
          <div className="flex flex-col gap-5">
            <WellPicker />
            {well && (
              <div className="grid grid-cols-3 gap-2 rounded-md border border-line bg-panel-2 p-3 text-xs">
                <div><div className="label">Li</div><div className="num text-sm">{num(well.chemistry.Li.value, 1)}</div></div>
                <div><div className="label">Mg</div><div className="num text-sm">{num(well.chemistry.Mg.value)}</div></div>
                <div><div className="label">Ca</div><div className="num text-sm">{num(well.chemistry.Ca.value)}</div></div>
              </div>
            )}
            <ConditionsForm value={conditions} onChange={setConditions} brinePh={well?.ph ?? null} brineTemp={well?.temp_c ?? null} />
            <Slider label="Brine processed" unit="m³/day" min={100} max={20000} step={100} value={flow} onChange={setFlow} hint="Used only to turn per-litre results into tonnes per year." />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {error && <Notice tone="error" title="The model could not run">{error}</Notice>}
          <Card
            title="Estimated result"
            kicker={loading ? <Spinner label="Updating" /> : `${e?.n_samples ?? 500} runs with different plausible assumptions`}
            actions={<Button variant="secondary" onClick={save} disabled={!e || saved}>{saved ? "Saved" : "Save as scenario"}</Button>}
          >
            {e && u ? (
              <>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                  <Stat
                    label="Lithium recovery"
                    value={pct(e.central.recovery)}
                    kind="model"
                    tone="good"
                    sub={`90% band ${pct(u.recovery.p5, 0)}–${pct(u.recovery.p95, 0)}`}
                  />
                  <Stat label="Lithium recovered" value={num(e.central.li_t_per_year, 1)} unit="t/yr" sub={`≈ ${num(e.central.lce_t_per_year)} t lithium carbonate equivalent`} />
                  <Stat label="Left in spent brine" value={num(e.central.residual_li_mg_l, 1)} unit="mg/L" sub={`of ${num(e.brine_used.li, 1)} mg/L coming in`} />
                  <Stat label="Operating cost" value={`$${smart(e.central.cost_usd_per_kg)}`} unit="/kg Li" sub={`band $${smart(u.cost_usd_per_kg.p5)}–$${smart(u.cost_usd_per_kg.p95)}`} />
                  <Stat label="Energy" value={smart(e.central.energy_kwh_per_kg)} unit="kWh/kg Li" sub={`${smart(e.central.heat_kwh_per_kg)} of it is heat`} />
                  <Stat label="Sodium hydroxide" value={smart(e.central.naoh_kg_per_kg)} unit="kg/kg Li" tone={e.central.naoh_kg_per_kg > 10 ? "warn" : "default"} sub="for pH adjustment" />
                </div>
                <div className="mt-5 grid gap-2 border-t border-line pt-4 text-sm text-ink-2">
                  <div>
                    Sorbent capacity usable at pH {e.central.ph_used.toFixed(1)}: <span className="num text-ink">{pct(e.central.capacity_fraction, 0)}</span>
                    {" · "}Approach to equilibrium in {conditions.contact_time_h} h: <span className="num text-ink">{pct(e.central.approach, 0)}</span>
                    {" · "}Mg/Li ratio: <span className="num text-ink">{num(e.mg_li_ratio)}</span>
                  </div>
                  {e.assumed_inputs.length > 0 && (
                    <div className="text-amber">Not measured for this well, so assumed: {e.assumed_inputs.map((k) => ASSUMED_LABEL[k] ?? k).join(", ")}.</div>
                  )}
                  <div className="text-xs text-ink-3">
                    Costs cover energy, chemicals and sorbent only, not equipment, labour or refining to battery-grade product. For context,
                    Standard Lithium reported 96.1% average recovery at its El Dorado demonstration plant (Jul–Aug 2023, company-reported, continuous multi-column process).
                  </div>
                </div>
              </>
            ) : (
              <Spinner label="Running model" />
            )}
          </Card>

          {e && (
            <>
              <Card title="Recovery as each condition changes" kicker="Other conditions held at your settings · amber line = current value">
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                  <div><div className="mb-1 text-sm text-ink-2">Contact time</div><SweepChart data={e.curves.contact_time_h} current={conditions.contact_time_h} xLabel="hours" /></div>
                  <div><div className="mb-1 text-sm text-ink-2">Temperature</div><SweepChart data={e.curves.temperature_c} current={conditions.temperature_c} xLabel="°C" /></div>
                  <div><div className="mb-1 text-sm text-ink-2">Target pH</div><SweepChart data={e.curves.ph_target} current={conditions.ph_target} xLabel="pH" /></div>
                  <div><div className="mb-1 text-sm text-ink-2">Sorbent dose</div><SweepChart data={e.curves.sorbent_dose_g_l} current={conditions.sorbent_dose_g_l} xLabel="g/L" /></div>
                </div>
                <p className="mt-3 text-xs text-ink-3">
                  In this model, temperature only changes how fast lithium is taken up, not how much the sorbent can hold.
                  Published studies disagree on that second effect, so it is left out rather than guessed. Sodium and calcium
                  competition is also not modelled (no reliable selectivity data).
                </p>
              </Card>

              <Card title="What drives this estimate" kicker="Recovery range as one input swings across its plausible range">
                <Tornado rows={e.sensitivity} base={e.central.recovery} />
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-3">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-teal" />published value</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-amber" />assumption</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-sky" />brine or operating input</span>
                </div>
                <p className="mt-2 text-xs text-ink-3">Long amber bars show where better experimental data would most improve the estimate.</p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
