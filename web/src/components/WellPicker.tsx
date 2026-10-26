"use client";

import { useStore } from "@/lib/store";
import { wellLabel } from "@/lib/format";

/** Dropdown of samples with the lithium, magnesium and calcium the extraction model needs. */
export function WellPicker({ value, onChange, label = "Brine sample" }: {
  value?: string;
  onChange?: (id: string) => void;
  label?: string;
}) {
  const { modelReady, well, selectWell } = useStore();
  const current = value ?? well?.id ?? "";
  const sorted = [...modelReady].sort((a, b) => (b.chemistry.Li.value ?? 0) - (a.chemistry.Li.value ?? 0));
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-2">{label}</span>
      <select value={current} onChange={(e) => (onChange ?? selectWell)(e.target.value)} className="min-h-[40px] w-full">
        {sorted.map((w) => (
          <option key={w.id} value={w.id}>
            {wellLabel(w)}, lithium {w.chemistry.Li.qualifier ?? ""}
            {w.chemistry.Li.value} mg/L{w.dataset.startsWith("USGS 2022") ? " (2022)" : w.date ? ` (${w.date.slice(0, 4)})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
