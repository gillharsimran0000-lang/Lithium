"use client";

import type { ReactNode } from "react";

export type Provenance = "measured" | "published" | "assumption" | "ml" | "model" | "missing";

const PROV: Record<Provenance, { label: string; cls: string; title: string }> = {
  measured: { label: "Measured", cls: "text-emerald border-emerald/50", title: "Laboratory or field measurement" },
  published: { label: "Published", cls: "text-teal border-teal/50", title: "Value reported in a cited source" },
  assumption: { label: "Assumption", cls: "text-amber border-amber/50 border-dashed", title: "Our stated estimate; no reliable published value" },
  ml: { label: "ML prediction", cls: "text-sky border-sky/50", title: "Predicted by a trained machine-learning model" },
  model: { label: "Literature model", cls: "text-amber border-amber/50", title: "Calculated by the literature-based process model, not measured" },
  missing: { label: "Not measured", cls: "text-slate border-slate/60", title: "No measurement available" },
};

export function Badge({ kind, children }: { kind: Provenance; children?: ReactNode }) {
  const p = PROV[kind];
  return (
    <span title={p.title} className={`label inline-flex items-center gap-1 rounded border px-1.5 py-0.5 !text-[10px] ${p.cls}`}>
      {children ?? p.label}
    </span>
  );
}

export function Card({ title, kicker, actions, children, className = "" }: {
  title?: ReactNode;
  kicker?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card rounded-lg border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {kicker && <div className="label mb-0.5">{kicker}</div>}
            {title && <h2 className="text-[15px] font-medium text-ink">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, sub, kind, tone = "default" }: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  kind?: Provenance;
  tone?: "default" | "good" | "warn";
}) {
  const color = tone === "good" ? "text-emerald" : tone === "warn" ? "text-amber" : "text-ink";
  return (
    <div className="min-w-0">
      <div className="label mb-1 flex items-center gap-2">
        {label}
        {kind && <Badge kind={kind} />}
      </div>
      <div className={`num text-2xl leading-tight ${color}`}>
        {value}
        {unit && <span className="ml-1 text-sm text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", disabled, type = "button", className = "" }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-emerald text-[#04140c] hover:bg-[#5ce3a1] font-medium",
    secondary: "border border-line-strong text-ink hover:border-ink-3 hover:bg-panel-2",
    ghost: "text-ink-2 hover:text-ink hover:bg-panel-2",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error"; title?: string; children: ReactNode }) {
  const cls = {
    info: "border-sky/40 bg-sky/5",
    warn: "border-amber/50 bg-amber/5",
    error: "border-red/50 bg-red/5",
  }[tone];
  return (
    <div className={`rounded-md border px-4 py-3 text-sm text-ink-2 ${cls}`} role={tone === "error" ? "alert" : undefined}>
      {title && <div className="mb-0.5 font-medium text-ink">{title}</div>}
      {children}
    </div>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange, hint }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  hint?: ReactNode;
}) {
  const id = `s-${label.replace(/\W+/g, "-")}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm text-ink-2">{label}</label>
        <span className="num text-sm text-ink">
          {value}
          {unit && <span className="ml-1 text-ink-3">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function PageHeader({ index, title, lede, children }: { index: string; title: string; lede: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="max-w-3xl">
        <span className="sr-only">{index}</span>
        <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-2 text-ink-2">{lede}</p>
      </div>
      {children}
    </div>
  );
}

export function Spinner({ label = "Working" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-3" role="status">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
      {label}
    </span>
  );
}

export function Table({ head, rows, className = "" }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="label border-b border-line px-3 py-2 text-left font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-ink-2">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
