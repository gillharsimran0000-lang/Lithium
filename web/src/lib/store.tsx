"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Brine, Conditions, Estimate, Optimization, Option, Sample, Scenario, Technology } from "./types";
import { isModelReady, wellLabel } from "./format";
import { inStudyArea } from "@/lib/studyArea";

// The first USGS 2022 sample from the Midway field: full chemistry, temperature and pH all measured.
const DEFAULT_WELL = "MW-1";
const SCENARIO_KEY = "lithiumoptimize.scenarios.v1";

export function brineFromSample(s: Sample): Brine {
  return {
    li: s.chemistry.Li.value!,
    mg: s.chemistry.Mg.value!,
    ca: s.chemistry.Ca.value!,
    na: s.chemistry.Na.value,
    tds: s.tds,
    temp_c: s.temp_c,
    ph: s.ph,
    specific_gravity: s.specific_gravity,
  };
}

// Manganese- and titanium-based materials release acid as they take up lithium, so they only work in
// less acidic water. They start at a higher pH; the aluminum-based material works at the brine's own pH.
export function startingPh(technology: Technology, s?: Sample) {
  const own = Math.round((s?.ph ?? 6) * 100) / 100;
  if (technology === "lmo") return Math.max(own, 8);
  if (technology === "hto") return Math.max(own, 9);
  return own;
}

export function defaultConditions(s?: Sample): Conditions {
  const temp = Math.min(Math.max(Math.round(s?.temp_c ?? 60), 20), 95);
  return {
    technology: "lial_ldh",
    temperature_c: temp,
    ph_target: Math.round((s?.ph ?? 6) * 100) / 100,
    contact_time_h: 1,
    sorbent_dose_g_l: 10,
    stages: 1,
  };
}

/** The operating conditions part of an optimizer option. */
export function toConditions(o: Option): Conditions {
  return {
    technology: o.technology,
    temperature_c: o.temperature_c,
    ph_target: o.ph_target,
    contact_time_h: o.contact_time_h,
    sorbent_dose_g_l: o.sorbent_dose_g_l,
    stages: o.stages,
  };
}

interface Store {
  wells: Sample[];
  wellsLoaded: boolean;
  modelReady: Sample[];
  well: Sample | undefined;
  selectWell: (id: string) => void;
  conditions: Conditions;
  setConditions: (c: Conditions) => void;
  flow: number;
  setFlow: (f: number) => void;
  estimate: Estimate | null;
  setEstimate: (e: Estimate | null) => void;
  optimization: Optimization | null;
  setOptimization: (o: Optimization | null) => void;
  scenarios: Scenario[];
  saveScenario: (s: Omit<Scenario, "id" | "savedAt">) => Scenario;
  removeScenario: (id: string) => void;
  demoStep: number | null;
  setDemoStep: (n: number | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [wells, setWells] = useState<Sample[]>([]);
  const [wellsLoaded, setWellsLoaded] = useState(false);
  const [wellId, setWellId] = useState(DEFAULT_WELL);
  const [conditions, setConditions] = useState<Conditions>(defaultConditions());
  const [flow, setFlow] = useState(1000);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [demoStep, setDemoStep] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data/wells.json")
      .then((r) => r.json())
      .then((data: Sample[]) => {
        setWells(data.filter((w) => inStudyArea(w.lat, w.lon)));
        setWellsLoaded(true);
        const first = data.find((w) => w.id === DEFAULT_WELL);
        if (first) setConditions(defaultConditions(first));
        try {
          const saved = localStorage.getItem(SCENARIO_KEY);
          if (saved) setScenarios(JSON.parse(saved));
        } catch {
          // Storage unavailable (private window); scenarios simply won't persist.
        }
      })
      // If the sample file can't load, finish loading anyway so the app never stays on the loading screen.
      .catch(() => setWellsLoaded(true));
  }, []);

  // Updates go through a function of the previous list, so two saves in a row both survive.
  const updateScenarios = useCallback((change: (prev: Scenario[]) => Scenario[]) => {
    setScenarios((prev) => {
      const next = change(prev);
      try {
        localStorage.setItem(SCENARIO_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const modelReady = useMemo(() => wells.filter(w => w.state.toLowerCase() === "arkansas" && isModelReady(w)), [wells]);
  const well = useMemo(() => wells.find((w) => w.id === wellId), [wells, wellId]);

  const selectWell = useCallback(
    (id: string) => {
      setWellId(id);
      const s = wells.find((w) => w.id === id);
      if (s) setConditions((c) => ({ ...defaultConditions(s), technology: c.technology }));
      setEstimate(null);
      setOptimization(null);
    },
    [wells],
  );

  const saveScenario = useCallback(
    (s: Omit<Scenario, "id" | "savedAt">) => {
      const full: Scenario = { ...s, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
      updateScenarios((prev) => [...prev, full]);
      return full;
    },
    [updateScenarios],
  );

  const removeScenario = useCallback(
    (id: string) => updateScenarios((prev) => prev.filter((s) => s.id !== id)),
    [updateScenarios],
  );

  const value: Store = {
    wells,
    wellsLoaded,
    modelReady,
    well,
    selectWell,
    conditions,
    setConditions,
    flow,
    setFlow,
    estimate,
    setEstimate,
    optimization,
    setOptimization,
    scenarios,
    saveScenario,
    removeScenario,
    demoStep,
    setDemoStep,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { wellLabel };
