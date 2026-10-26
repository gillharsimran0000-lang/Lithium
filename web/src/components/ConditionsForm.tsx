"use client";

import { Slider } from "./ui";
import { TECH_NAMES } from "@/lib/format";
import type { Conditions, Technology } from "@/lib/types";

const TECHS: Technology[] = ["lial_ldh", "lmo", "hto"];

export function ConditionsForm({ value, onChange, brinePh, brineTemp }: {
  value: Conditions;
  onChange: (c: Conditions) => void;
  brinePh: number | null;
  brineTemp: number | null;
}) {
  const set = <K extends keyof Conditions>(key: K, v: Conditions[K]) => onChange({ ...value, [key]: v });
  const phMin = Math.round((brinePh ?? 4) * 10) / 10;
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm text-ink-2">Extraction technology</legend>
        <div className="grid gap-2">
          {TECHS.map((t) => (
            <label
              key={t}
              className={`flex min-h-[40px] cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors duration-150 ${
                value.technology === t ? "border-emerald/70 bg-emerald/5 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3"
              }`}
            >
              <input
                type="radio"
                name="technology"
                className="accent-[var(--emerald)]"
                checked={value.technology === t}
                onChange={() => set("technology", t)}
              />
              {TECH_NAMES[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <Slider
        label="Operating temperature"
        unit="°C"
        min={20}
        max={95}
        step={1}
        value={value.temperature_c}
        onChange={(v) => set("temperature_c", v)}
        hint={brineTemp !== null ? `Brine arrives at ${brineTemp.toFixed(0)} °C. Higher means heating.` : "Brine temperature not measured; 60 °C assumed, near the median of the 2022 USGS samples."}
      />
      <Slider
        label="Target pH"
        min={phMin}
        max={12}
        step={0.1}
        value={Math.max(value.ph_target, phMin)}
        onChange={(v) => set("ph_target", Math.round(v * 10) / 10)}
        hint={`Brine pH is ${brinePh?.toFixed(2) ?? "not measured (6.0 assumed, near the 2022 USGS sample median)"}. Raising it uses sodium hydroxide.`}
      />
      <Slider label="Contact time" unit="h" min={0.25} max={12} step={0.25} value={value.contact_time_h} onChange={(v) => set("contact_time_h", v)} />
      <Slider label="Sorbent dose" unit="g/L" min={1} max={40} step={1} value={value.sorbent_dose_g_l} onChange={(v) => set("sorbent_dose_g_l", v)} />
      <Slider label="Sorption stages" min={1} max={4} step={1} value={value.stages} onChange={(v) => set("stages", v)} hint="Each stage meets fresh sorbent." />
    </div>
  );
}
