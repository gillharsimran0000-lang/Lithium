"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export const AXIS = { stroke: "#2a3d5a", tick: { fill: "#8194ad", fontSize: 11 }, tickLine: false };
export const GRID = { stroke: "#1c2b42", strokeDasharray: "2 4" };
export const TOOLTIP = {
  contentStyle: { background: "#122036", border: "1px solid #2a3d5a", borderRadius: 6, fontSize: 12, color: "#e4ebf4" },
  labelStyle: { color: "#a9b8cc" },
  itemStyle: { color: "#e4ebf4" },
  cursor: { stroke: "#2a3d5a" },
};

/** Recovery (%) as one operating variable changes, with the current setting marked. */
export function SweepChart({ data, current, xLabel, height = 180 }: {
  data: { x: number; recovery: number }[];
  current: number;
  xLabel: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data.map((d) => ({ ...d, r: d.recovery * 100 }))} margin={{ top: 8, right: 12, bottom: 18, left: -8 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} {...AXIS} tickCount={6} allowDecimals
          tickFormatter={(v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: "#8194ad", fontSize: 11 }} />
        <YAxis domain={[0, 100]} {...AXIS} unit="%" />
        <Tooltip {...TOOLTIP} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Recovery"]} labelFormatter={(l) => `${xLabel}: ${l}`} />
        <ReferenceLine x={current} stroke="#e9b44c" strokeDasharray="3 3" />
        <Line dataKey="r" stroke="#3dd68c" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars of how far recovery moves when each input swings across its range. */
export function Tornado({ rows, base }: {
  rows: { label: string; kind: string; recovery_at_low: number; recovery_at_high: number }[];
  base: number;
}) {
  const data = rows.map((r) => {
    const lo = Math.min(r.recovery_at_low, r.recovery_at_high) * 100;
    const hi = Math.max(r.recovery_at_low, r.recovery_at_high) * 100;
    return { label: r.label, kind: r.kind, range: [lo, hi] as [number, number] };
  });
  const color = (kind: string) => (kind === "published" ? "#2bb8b0" : kind === "assumption" ? "#e9b44c" : "#74b4f0");
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} unit="%" {...AXIS} />
        <YAxis type="category" dataKey="label" width={210} {...AXIS} tick={{ fill: "#a9b8cc", fontSize: 11 }} />
        <Tooltip
          {...TOOLTIP}
          formatter={(v) => {
            const [a, b] = v as unknown as [number, number];
            return [`${a.toFixed(1)}% to ${b.toFixed(1)}%`, "Recovery range"];
          }}
        />
        <ReferenceLine x={base * 100} stroke="#e4ebf4" strokeDasharray="3 3" />
        <Bar dataKey="range" isAnimationActive={false} barSize={14}>
          {data.map((d, i) => (
            <Cell key={i} fill={color(d.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Generic scatter with optional highlighted points and a y = x line. */
export function Scatterplot({ points, highlight = [], xLabel, yLabel, identity = false, logScale = false, height = 320, xUnit, yUnit }: {
  points: { x: number; y: number; name?: string }[];
  highlight?: { x: number; y: number; name?: string }[];
  xLabel: string;
  yLabel: string;
  identity?: boolean;
  logScale?: boolean;
  height?: number;
  xUnit?: string;
  yUnit?: string;
}) {
  const max = Math.max(...points.map((p) => Math.max(p.x, p.y)), 1);
  const scale = logScale ? "log" : "auto";
  // With a y = x line both axes must share one range, or the line would be drawn at the wrong angle.
  const domain: [number | string, number | string] = logScale ? ["auto", "auto"] : identity ? [0, Math.ceil(max / 100) * 100] : [0, "auto"];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
        <CartesianGrid {...GRID} />
        <XAxis type="number" dataKey="x" name={xLabel} scale={scale} domain={domain} {...AXIS}
          label={{ value: xLabel, position: "insideBottom", offset: -14, fill: "#8194ad", fontSize: 11 }} unit={xUnit} allowDataOverflow />
        <YAxis type="number" dataKey="y" name={yLabel} scale={scale} domain={domain} {...AXIS}
          label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 14, fill: "#8194ad", fontSize: 11 }} unit={yUnit} allowDataOverflow />
        <ZAxis range={[28, 28]} />
        <Tooltip {...TOOLTIP} formatter={(v, n) => [Number(v).toLocaleString(), n]} />
        {identity && <ReferenceLine segment={[{ x: 0, y: 0 }, { x: domain[1] as number, y: domain[1] as number }]} stroke="#a9b8cc" strokeDasharray="4 4" ifOverflow="extendDomain" />}
        <Scatter data={points} fill="#2bb8b0" fillOpacity={0.6} isAnimationActive={false} />
        {highlight.length > 0 && <Scatter data={highlight} fill="#e9b44c" shape="diamond" isAnimationActive={false} />}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Side-by-side bars for two scenarios across several metrics (each metric scaled to its own max). */
export function PairBars({ data, names }: {
  data: { metric: string; a: number; b: number }[];
  names: [string, string];
}) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 52 + 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" {...AXIS} />
        <YAxis type="category" dataKey="metric" width={170} {...AXIS} tick={{ fill: "#a9b8cc", fontSize: 11 }} />
        <Tooltip {...TOOLTIP} formatter={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Bar dataKey="a" name={names[0]} fill="#74b4f0" barSize={12} isAnimationActive={false} />
        <Bar dataKey="b" name={names[1]} fill="#3dd68c" barSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
