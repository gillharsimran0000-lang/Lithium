"use client";

import { Badge } from "./ui";
import { num } from "@/lib/format";
import type { Ion, Sample } from "@/lib/types";

const ROWS: { key: Ion; label: string }[] = [
  { key: "Li", label: "Lithium" },
  { key: "Mg", label: "Magnesium" },
  { key: "Ca", label: "Calcium" },
  { key: "Na", label: "Sodium" },
  { key: "K", label: "Potassium" },
  { key: "Sr", label: "Strontium" },
  { key: "Br", label: "Bromide" },
  { key: "Cl", label: "Chloride" },
];

function Value({ v, unit, digits = 0, qualifier }: { v: number | null; unit: string; digits?: number; qualifier?: string | null }) {
  if (v === null) return <Badge kind="missing" />;
  return (
    <span className="num text-ink">
      {qualifier === "<" ? "below " : qualifier === ">" ? "above " : ""}
      {num(v, digits)} <span className="text-ink-3">{unit}</span>
    </span>
  );
}

export function SampleDetail({ s, compact = false }: { s: Sample; compact?: boolean }) {
  const li = s.chemistry.Li.value;
  const mg = s.chemistry.Mg.value;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="text-base font-medium text-ink">{s.name ?? `Sample ${s.id}`}</div>
        <div className="text-ink-3">
          {[s.field && `${s.field} field`, s.county && `${s.county} County`, s.state].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge kind="measured">{s.dataset.startsWith("USGS 2022") ? "USGS 2022 lab analysis" : "Historical record"}</Badge>
          {s.usgs_model_role && <Badge kind="ml">{`USGS model ${s.usgs_model_role} set`}</Badge>}
          {s.coord_note && <Badge kind="assumption">{s.coord_note}</Badge>}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-ink-3">Sampled</dt>
        <dd>{s.date ?? <Badge kind="missing">Date not recorded</Badge>}</dd>
        <dt className="text-ink-3">Formation</dt>
        <dd>{s.formation ?? <Badge kind="missing" />}</dd>
        <dt className="text-ink-3">Depth (lower)</dt>
        <dd><Value v={s.depth_ft} unit="ft" /></dd>
        <dt className="text-ink-3">Location</dt>
        <dd className="num">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</dd>
      </dl>

      <div>
        <div className="label mb-1.5">Brine chemistry</div>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.slice(0, compact ? 4 : ROWS.length).map((r) => (
              <tr key={r.key} className="border-b border-line/60">
                <td className="py-1.5 text-ink-2">{r.label}</td>
                <td className="py-1.5 text-right">
                  <Value v={s.chemistry[r.key].value} qualifier={s.chemistry[r.key].qualifier} unit="mg/L" digits={r.key === "Li" ? 1 : 0} />
                </td>
              </tr>
            ))}
            <tr className="border-b border-line/60">
              <td className="py-1.5 text-ink-2">Total dissolved solids</td>
              <td className="py-1.5 text-right"><Value v={s.tds} unit="mg/L" /></td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-1.5 text-ink-2">Temperature{s.temp_note ? ` (${s.temp_note})` : ""}</td>
              <td className="py-1.5 text-right"><Value v={s.temp_c} unit="°C" digits={1} /></td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-1.5 text-ink-2">pH</td>
              <td className="py-1.5 text-right"><Value v={s.ph} unit="" digits={2} /></td>
            </tr>
            {li !== null && mg !== null && (
              <tr>
                <td className="py-1.5 text-ink-2">Mg/Li ratio (calculated)</td>
                <td className="num py-1.5 text-right text-ink">{num(mg / li, 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!compact && <p className="text-xs leading-relaxed text-ink-3">Source: {s.reference}</p>}
    </div>
  );
}
