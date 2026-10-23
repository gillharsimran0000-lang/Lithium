"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Notice, PageHeader } from "@/components/ui";
import { SampleDetail } from "@/components/SampleDetail";
import { WellPicker } from "@/components/WellPicker";
import { AXIS, GRID, Scatterplot, TOOLTIP } from "@/components/charts";
import { useStore } from "@/lib/store";
import { num } from "@/lib/format";
import type { Ion } from "@/lib/types";

const IONS: { key: Ion; label: string }[] = [
  { key: "Li", label: "Lithium" },
  { key: "Mg", label: "Magnesium" },
  { key: "Ca", label: "Calcium" },
  { key: "Na", label: "Sodium" },
  { key: "K", label: "Potassium" },
  { key: "Sr", label: "Strontium" },
  { key: "Br", label: "Bromide" },
];

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function BrinePage() {
  const { well, wells: allWells } = useStore();
  const wells = useMemo(() => allWells.filter(w => w.state.toLowerCase() === "arkansas"), [allWells]);

  const pairs = useMemo(
    () =>
      wells
        .filter((w) => w.chemistry.Li.value !== null && w.chemistry.Mg.value !== null && w.chemistry.Li.value! > 0)
        .map((w) => ({ x: w.chemistry.Li.value!, y: w.chemistry.Mg.value!, name: w.name ?? w.id })),
    [wells],
  );

  const composition = useMemo(() => {
    if (!well) return [];
    return IONS.map(({ key, label }) => ({
      label,
      selected: well.chemistry[key].value,
      median: median(wells.map((w) => w.chemistry[key].value).filter((v): v is number => v !== null && v > 0)),
    }));
  }, [well, wells]);

  const ratio = well && well.chemistry.Li.value && well.chemistry.Mg.value ? well.chemistry.Mg.value / well.chemistry.Li.value : null;
  const ratios = pairs.map((p) => p.y / p.x).sort((a, b) => a - b);
  const rank = ratio !== null ? ratios.filter((r) => r <= ratio).length / ratios.length : null;

  return (
    <div>
      <PageHeader
        index="03 · Brine Analysis"
        title="What is in this brine, and why it matters for extraction"
        lede="Lithium is only a tiny part of Smackover brine. Most of the salt is sodium and calcium chloride, and magnesium competes with lithium for space on DLE sorbents."
      >
        <div className="w-full sm:w-[380px]">
          <WellPicker />
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card title="Measured chemistry" kicker="Selected sample">
          {well ? <SampleDetail s={well} /> : <p className="text-sm text-ink-3">Loading…</p>}
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Composition compared with the median Arkansas sample" kicker="mg/L, logarithmic scale">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={composition} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" scale="log" domain={[0.1, 200000]} allowDataOverflow {...AXIS}
                  tickFormatter={(v) => Number(v).toLocaleString()} ticks={[1, 10, 100, 1000, 10000, 100000]} />
                <YAxis type="category" dataKey="label" width={90} {...AXIS} tick={{ fill: "#a9b8cc", fontSize: 12 }} />
                <Tooltip {...TOOLTIP} formatter={(v, n) => [v === null ? "not measured" : `${Number(v).toLocaleString()} mg/L`, n]} />
                <Bar dataKey="selected" name="This sample" fill="#3dd68c" barSize={10} isAnimationActive={false} />
                <Bar dataKey="median" name="Median of Arkansas samples" fill="#5b6b82" barSize={10} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-ink-3">Green: this sample (measured). Grey: median of every Arkansas sample in this dataset where that ion was measured. Missing bars mean not measured.</p>
          </Card>

          <Card title="Magnesium versus lithium in every sample" kicker={`${pairs.length} samples with both measured`}>
            <Scatterplot
              points={pairs}
              highlight={well && well.chemistry.Li.value && well.chemistry.Mg.value ? [{ x: well.chemistry.Li.value, y: well.chemistry.Mg.value, name: "Selected" }] : []}
              xLabel="Lithium (mg/L)"
              yLabel="Magnesium (mg/L)"
              logScale
            />
            {ratio !== null && rank !== null && (
              <Notice title={`Mg/Li ratio: ${num(ratio)} (higher than ${num(rank * 100)}% of samples)`}>
                Magnesium ions are similar in size to lithium ions, so they compete for sorbent sites. A higher ratio means
                lower recovery for the same setup. For ion-sieve sorbents it also means more sodium hydroxide is wasted
                precipitating magnesium if the brine&apos;s pH is raised above about 9. The amber diamond is the selected sample.
              </Notice>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
