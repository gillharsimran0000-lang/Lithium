"use client";

import { useStore } from "@/lib/store";
import { pct, TECH_NAMES } from "@/lib/format";
import type { Conditions, Estimate } from "@/lib/types";

// A live picture of the recovery setup. Settings change it straight away (tank colour, beads, tanks);
// the lithium that moves onto the beads, the meters and the explanation come from the model's estimate.
const DOTS = 20;
// Spots inside a tank, as fractions of its width and of the brine's height. Fixed so server and browser match.
const SPOTS = [[.2, .1], [.62, .16], [.38, .28], [.82, .3], [.12, .42], [.52, .46], [.3, .6], [.74, .58], [.46, .74], [.88, .78],
  [.18, .82], [.64, .88], [.1, .22], [.9, .52], [.34, .9], [.56, .06], [.74, .38], [.24, .68], [.84, .94], [.44, .52]];
const W = 300, TOP = 40, BRINE = 250, BED = 60;

// Cool teal at 20 °C, warm amber at 95 °C.
function brineColour(t: number) {
  const f = Math.max(0, Math.min(1, (t - 20) / 75));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${mix(28, 120)}, ${mix(84, 78)}, ${mix(88, 42)})`;
}

// The one thing most holding this setup back, in plain words.
function explain(c: Conditions, e: Estimate | null) {
  if (!e) return "Select “See results” to run the simulation.";
  const r = e.central;
  if (c.technology !== "lial_ldh" && r.recovery < 0.02) return "This material can’t capture lithium in water this acidic. Raise the target pH in Advanced settings.";
  if (r.approach < 0.85) return "Capture is still under way. More processing time or warmer water would capture more lithium.";
  if (r.capacity_fraction > 0.9) return "The material is nearly full, so more time or heat does little. More material or another stage would capture more.";
  return "Capture has finished and the material still has room. This setup is close to its limit for this brine.";
}

export function ProcessSim() {
  const { conditions: c, estimate } = useStore();
  const e = estimate && estimate.technology === c.technology ? estimate : null;
  const tanks = c.stages;
  const gap = 10;
  const tankW = (W - 20 - gap * (tanks - 1)) / tanks;
  const beads = Math.max(1, Math.min(9, Math.round(c.sorbent_dose_g_l / 4) + 1));
  const inactive = Boolean(e && c.technology !== "lial_ldh" && e.central.recovery < 0.02);
  const captured = e ? Math.round(e.central.recovery * DOTS) : 0;
  const sludge = e ? Math.min(14, Math.ceil(e.central.sludge_kg_per_kg / 3)) : 0;
  const jiggle = `${(3.2 - ((c.temperature_c - 20) / 75) * 2.2).toFixed(2)}s`;
  const tankX = (i: number) => 10 + i * (tankW + gap);
  // Beads spread evenly along the bottom of each tank.
  const beadSpot = (tank: number, k: number) => [tankX(tank) + ((k + 0.5) * tankW) / beads, TOP + BRINE + BED / 2];
  // Captured lithium settles into the bed, each dot in its own place, filling from the bottom row up.
  const seatSpot = (tank: number, k: number) => {
    const perRow = Math.max(1, Math.floor((tankW - 12) / 10));
    return [tankX(tank) + 10 + (k % perRow) * 10, TOP + BRINE + BED - 10 - Math.floor(k / perRow) * 10];
  };
  const dots = Array.from({ length: DOTS }, (_, i) => {
    const tank = i % tanks;
    const k = Math.floor(i / tanks);
    const [fx, fy] = SPOTS[k];
    const home = [tankX(tank) + 8 + fx * (tankW - 16), TOP + 10 + fy * (BRINE - 20)];
    return { home, seat: seatSpot(tank, k), caught: i < captured };
  });
  const meters = [
    { label: "Capture progress", hint: "processing time and temperature", value: e?.central.approach ?? 0 },
    { label: "Material filled", hint: "material amount", value: e?.central.capacity_fraction ?? 0 },
    { label: "Lithium captured", hint: "the result", value: e?.central.recovery ?? 0 },
  ];
  return (
    <div className="process-sim">
      <div className="sim-head"><span>Live simulation</span><span>{TECH_NAMES[c.technology]} · {c.temperature_c} °C</span></div>
      <svg viewBox={`0 0 ${W} ${TOP + BRINE + BED + 10}`} aria-hidden style={{ ["--jiggle" as string]: jiggle }}>
        {Array.from({ length: tanks }, (_, i) => (
          <g key={i}>
            <rect x={tankX(i)} y={TOP} width={tankW} height={BRINE + BED} rx="10" className="sim-tank" />
            <rect x={tankX(i) + 2} y={TOP + 2} width={tankW - 4} height={BRINE + BED - 4} rx="8" fill={brineColour(c.temperature_c)} className="sim-brine" />
            <text x={tankX(i) + tankW / 2} y={TOP - 12} className="sim-label">Stage {i + 1}</text>
            {Array.from({ length: beads }, (_, k) => {
              const [x, y] = beadSpot(i, k);
              return <circle key={k} cx={x} cy={y} r={Math.min(14, tankW / beads / 2 - 2)} className={inactive ? "sim-bead is-inactive" : "sim-bead"} />;
            })}
            {Array.from({ length: Math.ceil(sludge / tanks) }, (_, k) => (
              <rect key={k} x={tankX(i) + 6 + ((k * 23) % (tankW - 16))} y={TOP + BRINE + BED - 8 - (k % 2) * 3} width="8" height="3" rx="1.5" className="sim-sludge" />
            ))}
          </g>
        ))}
        {dots.map((d, i) => (
          <g key={i} className="sim-dot-slot" style={{ transform: `translate(${(d.caught ? d.seat : d.home)[0]}px, ${(d.caught ? d.seat : d.home)[1]}px)` }}>
            <circle r="3.6" className={d.caught ? "sim-li is-caught" : "sim-li"} style={{ animationDelay: `${(i % 5) * -0.6}s` }} />
          </g>
        ))}
      </svg>
      <dl className="sim-meters">
        {meters.map((m) => (
          <div key={m.label}>
            <dt>{m.label} <small>{m.hint}</small></dt>
            <dd>{e ? pct(m.value, 0) : "n/a"}</dd>
            <span className="sim-bar"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, m.value))})` }} /></span>
          </div>
        ))}
      </dl>
      <p className="sim-caption" aria-live="polite">{explain(c, e)}</p>
      {e && e.central.sludge_kg_per_kg > 0 && <p className="sim-caption is-note">At this pH, magnesium drops out as sludge, which adds chemicals and cost.</p>}
      <p className="sim-legend"><span className="sim-key" /> lithium in the brine <span className="sim-key is-bead" /> capture material</p>
    </div>
  );
}
