"use client";

import dynamic from "next/dynamic";
import allCounties from "@/lib/counties.json";
import { STUDY_COUNTIES } from "@/lib/studyArea";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, PageHeader, Slider } from "@/components/ui";
import { WellPicker } from "@/components/WellPicker";
import { SampleDetail } from "@/components/SampleDetail";
import { LI_STOPS, type GridLayer } from "@/components/MapView";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { completeness, isModelReady, num, wellLabel } from "@/lib/format";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="map-loading" role="status"><span className="skeleton" /><p>Loading map…</p></div>,
});

const counties = allCounties.filter((c) => STUDY_COUNTIES.includes(c.name));

type Completeness = "any" | "lithium" | "model" | "full";
const COMPLETENESS: Record<Completeness, string> = {
  any: "All samples",
  lithium: "Lithium measured",
  model: "Ready to estimate recovery",
  full: "All key measurements available",
};

export default function MapPage() {
  const { wells, wellsLoaded, well, selectWell } = useStore();
  const [county, setCounty] = useState("");
  const selectedCounty = counties.find(c => c.name === county);
  const [minLi, setMinLi] = useState(0);
  const [level, setLevel] = useState<Completeness>("any");
  const [dataset, setDataset] = useState<"all" | "2022" | "historical">("all");
  const [grid, setGrid] = useState<GridLayer>("none");
  const [picked, setPicked] = useState<string[]>([]);
  const [probe, setProbe] = useState<{ lat: number; lon: number; text: string } | null>(null);

  useEffect(() => {
    function reset() { setCounty(""); setLevel("any"); setMinLi(0); setDataset("all"); setPicked([]); setProbe(null); }
    window.addEventListener("reset-explorer", reset);
    return () => window.removeEventListener("reset-explorer", reset);
  }, []);

  const filtered = useMemo(
    () =>
      wells.filter((w) => {
        if (w.state.toLowerCase() !== "arkansas") return false;
        if (county && w.county?.toLowerCase() !== county.toLowerCase()) return false;
        if (dataset === "2022" && !w.dataset.startsWith("USGS 2022")) return false;
        if (dataset === "historical" && w.dataset.startsWith("USGS 2022")) return false;
        if (level === "lithium" && w.chemistry.Li.value === null) return false;
        if (level === "model" && !isModelReady(w)) return false;
        if (level === "full" && completeness(w) < 1) return false;
        if (minLi > 0 && (w.chemistry.Li.value ?? -1) < minLi) return false;
        return true;
      }),
    [wells, minLi, level, dataset, county],
  );

  const pickedSamples = picked.map((id) => wells.find((w) => w.id === id)).filter(Boolean) as typeof wells;
  const shown = pickedSamples[0] ?? well;

  async function probeLocation(lat: number, lon: number) {
    setProbe({ lat, lon, text: "Running the lithium model for this 2 km cell…" });
    try {
      const r = await api.mlPredict(lat, lon);
      if (!r.in_domain) setProbe({ lat, lon, text: r.message ?? "Outside the modelled area." });
      else
        setProbe({
          lat,
          lon,
          text: `ML prediction ${num(r.prediction_mg_l)} mg/L (90% range ${num(r.interval_mg_l![0])}–${num(r.interval_mg_l![1])}). USGS model: ${num(r.usgs_prediction_mg_l)} mg/L.`,
        });
    } catch (e) {
      setProbe({ lat, lon, text: e instanceof Error ? e.message : "Outside the modelled area." });
    }
  }

  return (
    <div>
      <PageHeader
        index="02 · Arkansas Lithium Map"
        title="Find a place. Follow the evidence."
        lede="Choose a county or a measured sample in southern Arkansas, where USGS studied lithium in the Smackover brine."
      />

      <div className="county-toolbar">
        <label htmlFor="county">Explore a county<select id="county" value={county} onChange={e => { setCounty(e.target.value); setPicked([]); setProbe(null); }}><option value="">Whole study area</option>{counties.map(c => <option key={c.name} value={c.name}>{c.name} County</option>)}</select></label>
        <WellPicker label="Or choose a measured sample" />
        <p aria-live="polite">{wellsLoaded ? `${filtered.length.toLocaleString()} matching samples${county ? ` in ${county} County` : " in the study area"}` : "Loading USGS sample records…"}<span>County coverage does not imply lithium potential.</span></p>
        <button className="quiet-link" onClick={() => { setCounty(""); setLevel("any"); setMinLi(0); setDataset("all"); setPicked([]); setProbe(null); }}>Reset filters ↺</button>
      </div>
      {wellsLoaded && filtered.length === 0 && <div className="mb-4 rounded-lg border border-line-strong bg-panel-2 p-4" role="status"><strong>No matching sample records{county ? ` in ${county} County` : ""}.</strong><p className="mt-1 text-sm text-ink-2">Try “All samples” or reset the filters. No records means no evidence in this dataset, not zero lithium. The working sample below remains unchanged.</p></div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <div className="relative h-[380px] sm:h-[470px] overflow-hidden rounded-lg border border-line">
            <MapView bounds={selectedCounty?.bounds} samples={filtered} selectedId={shown?.id} grid={grid} onSelect={setPicked} onMapClick={probeLocation} />
            <div className="pointer-events-none absolute bottom-8 left-3 right-14 rounded-md border border-line bg-bg/90 px-3 py-2 text-xs">
              <div className="label mb-1">Lithium, mg/L</div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {LI_STOPS.map(([v, c]) => (
                  <span key={v} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                    <span className="num text-ink-2">{v}{v === 300 ? "+" : ""}</span>
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full border border-slate" />
                  <span className="text-ink-2">not measured</span>
                </span>
              </div>
            </div>
          </div>
          {probe && (
            <div className="rounded-md border border-sky/40 bg-sky/5 px-4 py-2.5 text-sm text-ink-2" aria-live="polite">
              <span className="num mr-2 text-ink-3">{probe.lat.toFixed(3)}, {probe.lon.toFixed(3)}</span>
              {probe.text}
            </div>
          )}

          <details className="inline-details map-filters"><summary>Map filters & prediction layers <span>+</span></summary><div className="advanced-controls">
            <div className="grid gap-5 md:grid-cols-3">
              <Slider label="Minimum lithium" unit="mg/L" min={0} max={400} step={10} value={minLi} onChange={setMinLi} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-2">Data completeness</span>
                <select value={level} onChange={(e) => setLevel(e.target.value as Completeness)} className="min-h-[40px]">
                  {Object.entries(COMPLETENESS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-2">Dataset</span>
                <select value={dataset} onChange={(e) => setDataset(e.target.value as typeof dataset)} className="min-h-[40px]">
                  <option value="all">All records</option>
                  <option value="2022">USGS 2022 sampling only</option>
                  <option value="historical">Historical records (1965–2018)</option>
                </select>
              </label>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm text-ink-2">Background layer (2 km cells, Smackover Reynolds oolite)</legend>
              <div className="flex flex-wrap gap-2">
                {([
                  ["none", "None"],
                  ["usgs_pred", "USGS lithium prediction"],
                  ["ml_pred", "Our ML prediction"],
                ] as [GridLayer, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setGrid(k)}
                    aria-pressed={grid === k}
                    className={`min-h-[36px] cursor-pointer rounded-md border px-3 text-sm transition-colors duration-150 ${
                      grid === k ? "border-sky/70 bg-sky/10 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {grid !== "none" && (
                <p className="mt-2 text-xs text-ink-3">
                  <Badge kind="ml" /> Predicted, not measured. Cells are about 1.5 square miles; USGS notes these maps are
                  not suitable for estimating lithium at a single site.
                </p>
              )}
            </fieldset>
          </div></details>
        </div>

        <div className="flex flex-col gap-4">
          {pickedSamples.length > 1 && (
            <Card title={`${pickedSamples.length} samples at this point`}>
              <div className="flex flex-col gap-1">
                {pickedSamples.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPicked([s.id, ...picked.filter((p) => p !== s.id)])}
                    className="cursor-pointer rounded px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-panel-2"
                  >
                    {wellLabel(s)} · {s.date ?? "date not recorded"} · Li {s.chemistry.Li.value ?? "n/a"}
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card kicker={pickedSamples.length ? "Clicked sample" : "Selected sample"} title="Sample details">
            {shown ? (
              <>
                <div className="compact-sample"><span className="sample-provenance">USGS sample record</span><h3>{wellLabel(shown)}</h3><p>{shown.county ?? "Unknown"} County · {shown.formation ?? "Formation not recorded"}</p><dl><div><dt>Measured lithium</dt><dd>{num(shown.chemistry.Li.value, 1)} <small>mg/L</small></dd></div></dl><p className="field-help">mg/L means milligrams of lithium in one litre of water. This measurement describes one sample, not the whole county. A dash means no measurement.</p></div>
                <details className="inline-details"><summary>Measurements & source <span>+</span></summary><div className="advanced-controls"><SampleDetail s={shown} /></div></details>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isModelReady(shown) ? (
                    <Button onClick={() => { if (shown.id !== well?.id) selectWell(shown.id); window.location.hash = "predict"; }}>
                      Try this sample →
                    </Button>
                  ) : (
                    <p className="text-xs text-ink-3">
                      This record does not have enough measurements to estimate recovery. Choose a sample from the list above.
                    </p>
                  )}

                </div>
              </>
            ) : (
              <p className="text-sm text-ink-3">Click a point on the map.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
