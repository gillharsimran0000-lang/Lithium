import type { Sample, Technology } from "./types";

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export function num(x: number | null | undefined, digits = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return "n/a";
  return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Pick sensible precision for a value of any size. */
export function smart(x: number | null | undefined) {
  if (x === null || x === undefined || Number.isNaN(x)) return "n/a";
  const a = Math.abs(x);
  if (a < 0.0005) return "0";
  if (a >= 100) return num(x, 0);
  if (a >= 10) return num(x, 1);
  if (a >= 1) return num(x, 2);
  return num(x, 3);
}

export const TECH_NAMES: Record<Technology, string> = {
  lial_ldh: "Aluminum-based",
  lmo: "Manganese-based",
  hto: "Titanium-based",
};

export const TECH_SHORT: Record<Technology, string> = { lial_ldh: "LDH", lmo: "LMO", hto: "HTO" };

export const TECH_COLORS: Record<Technology, string> = {
  lial_ldh: "#3dd68c",
  lmo: "#e9b44c",
  hto: "#74b4f0",
};

export function wellLabel(s: Sample) {
  const name = s.name ?? `Sample ${s.id}`;
  return s.field ? `${name} · ${s.field}` : name;
}

export function isModelReady(s: Sample) {
  return s.chemistry.Li.value !== null && s.chemistry.Mg.value !== null && s.chemistry.Ca.value !== null;
}

/** Share of the key measurements this sample has, 0-1. */
export function completeness(s: Sample) {
  const fields = [
    s.chemistry.Li.value,
    s.chemistry.Mg.value,
    s.chemistry.Ca.value,
    s.chemistry.Na.value,
    s.tds,
    s.temp_c,
    s.ph,
  ];
  return fields.filter((v) => v !== null).length / fields.length;
}
