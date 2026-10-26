"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { brineFromSample, defaultConditions, startingPh, useStore } from "@/lib/store";
import { num, pct, smart, TECH_NAMES, wellLabel } from "@/lib/format";
import { Slider } from "./ui";
import { useTweened } from "@/lib/useTweened";
import type { Estimate, Technology } from "@/lib/types";

export function RecoveryStudio() {
  const { well, conditions, setConditions, flow, setFlow, estimate: sharedEstimate, setEstimate, saveScenario } = useStore();
  const [result, setResult] = useState<{ key: string; estimate: Estimate } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const request = useRef(0);
  const key = JSON.stringify([well?.id, conditions, flow]);
  const currentKey = useRef(key);
  useEffect(() => { currentKey.current = key; }, [key]);
  const sharedMatches = sharedEstimate && well
    && Object.entries(conditions).every(([field, value]) => sharedEstimate.conditions[field as keyof typeof conditions] === value)
    && sharedEstimate.brine_used.li === well.chemistry.Li.value
    && sharedEstimate.brine_used.mg === well.chemistry.Mg.value
    && sharedEstimate.brine_used.ca === well.chemistry.Ca.value
    && sharedEstimate.brine_used.temp_c === (well.temp_c ?? 60)
    && sharedEstimate.brine_used.ph === (well.ph ?? 6)
    && Math.abs(sharedEstimate.central.li_t_per_year - sharedEstimate.central.li_recovered_g_m3 * flow * 365 / 1e6) < 1e-6;
  const e = result?.key === key ? result.estimate : sharedMatches ? sharedEstimate : result?.estimate;
  const fresh = result?.key === key || Boolean(sharedMatches);
  const update = (field: keyof typeof conditions, value: number) => setConditions({ ...conditions, [field]: value });
  const run = useCallback(async () => {
    if (!well) return;
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const estimate = await api.estimate(brineFromSample(well), conditions, flow);
      if (id !== request.current) return;
      setResult({key, estimate}); if (currentKey.current === key) setEstimate(estimate); setSavedKey("");
    } catch (err) { setError(err instanceof Error ? err.message : "The estimate could not run. Please try again."); }
    finally { if (id === request.current) setBusy(false); }
  }, [well, conditions, flow, key, setEstimate]);
  // After the first result, recalculate by itself a moment after a setting stops changing.
  const started = Boolean(e);
  useEffect(() => {
    if (!started || fresh) return;
    const timer = setTimeout(run, 350);
    return () => clearTimeout(timer);
  }, [started, fresh, run]);
  const shownRecovery = useTweened(e?.central.recovery ?? 0);
  function save() {
    if (!well || !e || !fresh) return;
    saveScenario({name: `${TECH_NAMES[conditions.technology]} · ${conditions.temperature_c} °C`, wellId: well.id, wellLabel: wellLabel(well), brine: brineFromSample(well), conditions, flow_m3_day: flow, estimate: e, origin: "manual"});
    setSavedKey(key);
  }
  return <div className="recovery-studio">
    <div className="studio-controls">
      <div className="studio-sample"><span className="status-dot" /><span>Using <strong>{well ? wellLabel(well) : "your selected sample"}</strong></span><a href="#map">Change</a></div>
      <label className="studio-label" htmlFor="studio-tech">Recovery option<select id="studio-tech" value={conditions.technology} onChange={ev => { const technology = ev.target.value as Technology; setConditions({...conditions, technology, ph_target: startingPh(technology, well)}); }}><option value="lial_ldh">Aluminum-based</option><option value="lmo">Manganese-based</option><option value="hto">Titanium-based</option></select></label>
      <p className="field-help">Choose a material to capture lithium from salty water. Manganese- and titanium-based materials only work in alkaline water, so choosing one raises the starting pH. Watch the simulation on the right as you move the sliders.</p>
      <Slider label="Water temperature" unit="°C" min={20} max={95} step={1} value={conditions.temperature_c} onChange={v=>update("temperature_c",v)} hint={well?.temp_c != null ? `This sample was measured at ${num(well.temp_c)} °C.` : "Sample temperature is missing; the model assumes 60 °C, near the median of the 2022 USGS samples."} />
      <Slider label="Processing time" unit="h" min={.25} max={12} step={.25} value={conditions.contact_time_h} onChange={v=>update("contact_time_h",v)} hint="How long the material stays in contact with the water." />
      <div className="flex flex-wrap items-center gap-4"><button type="button" className="quiet-link" disabled={!well || busy} onClick={() => { setConditions(defaultConditions(well)); setFlow(1000); }}>Reset to starting settings ↺</button></div>
      <details className="inline-details"><summary>Advanced settings <span>+</span></summary><div className="advanced-controls"><Slider label="Target pH" min={Math.min(well?.ph ?? 6, conditions.ph_target)} max={12} step={.1} value={conditions.ph_target} onChange={v=>update("ph_target",v)} /><Slider label="Material dose" unit="g/L" min={1} max={40} step={1} value={conditions.sorbent_dose_g_l} onChange={v=>update("sorbent_dose_g_l",v)} /><Slider label="Extraction stages" min={1} max={4} step={1} value={conditions.stages} onChange={v=>update("stages",v)} /><Slider label="Daily brine volume" unit="m³" min={100} max={20000} step={100} value={flow} onChange={setFlow} /></div></details>
      <button className="primary-link studio-run" onClick={run} disabled={busy || !well}>{busy ? "Calculating your estimate…" : e ? "Update estimate" : "See results"}<span aria-hidden>{busy ? "…" : "↗"}</span></button>
      {error && <p className="studio-error" role="alert">{error}</p>}
    </div>
    <div className="studio-results" aria-live="polite" aria-busy={busy}>
      <div className="results-heading"><span>What this option could deliver</span><span className="model-label">Research estimate</span></div>
      {e ? <>
        <p className="stale-result" aria-hidden={fresh}>{fresh ? "\u00a0" : "Updating for your new settings…"}</p>
        <div className={`recovery-total${fresh ? "" : " is-updating"}`}><strong>{pct(shownRecovery)}</strong><span>of the sample’s lithium could be recovered</span></div>
        <div className="recovery-track" role="img" aria-label={`${pct(e.central.recovery)} lithium recovered`}><span style={{transform:`scaleX(${Math.max(0,Math.min(1,shownRecovery))})`}} /></div>
        <p className="uncertainty-note">Estimated range: {pct(e.uncertainty.recovery.p5,0)}–{pct(e.uncertainty.recovery.p95,0)} under the model’s assumptions.</p>
        <dl className={`tradeoff-list${fresh ? "" : " is-updating"}`}><div><dt>Operating cost</dt><dd>${smart(e.central.cost_usd_per_kg)} <small>/ kg lithium (energy, chemicals, sorbent)</small></dd></div><div><dt>Energy needed</dt><dd>{smart(e.central.energy_kwh_per_kg)} <small>kWh / kg</small></dd></div><div><dt>Fresh water</dt><dd>{num(e.central.water_m3_per_kg * 1000)} <small>litres / kg lithium</small></dd></div></dl>
        <div className="result-actions"><button onClick={save} disabled={!fresh || savedKey === key} className="secondary-link">{savedKey === key ? "✓ Saved for comparison" : "Save this setup"}</button><a href="#compare">Compare setups →</a></div>
        {e.assumed_inputs.length > 0 && <p className="uncertainty-note">Missing measurements filled with assumptions: {e.assumed_inputs.join(", ")}.</p>}
      </> : busy ? <div className="results-skeleton" aria-hidden><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div> : <div className="results-empty"><svg viewBox="0 0 160 70" fill="none" aria-hidden><path d="M5 60H155M20 60V42M48 60V33M76 60V25M104 60V17M132 60V8" stroke="currentColor" strokeWidth="8" /><path d="m12 31 38-9 30-4 34-10 30-4" stroke="var(--emerald)" strokeWidth="2" /></svg><h3>See what your setup could do.</h3><p>Choose an option, try a different temperature or processing time, then select “See results”.</p></div>}
      <p className="model-footnote">Based on published research and assumptions drawn from it. Costs exclude equipment, labour, and refining. <a href="#methodology">How it works ↗</a></p>
    </div>
  </div>;
}
