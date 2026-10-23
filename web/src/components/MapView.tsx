"use client";

import { type GeoJSONSource, Map as MLMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { Sample } from "@/lib/types";
import { STUDY_BOUNDS, STUDY_COUNTIES } from "@/lib/studyArea";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Worker file copied into public/ by scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Lithium colour scale, mg/L. Sequential, light-to-bright so larger values stand out.
export const LI_STOPS: [number, string][] = [
  [0, "#1f3a5a"],
  [50, "#2b6d8f"],
  [100, "#2bb8b0"],
  [200, "#3dd68c"],
  [300, "#c9ef6b"],
];

export type GridLayer = "none" | "usgs_pred" | "ml_pred";

function liColor(prop: unknown[]) {
  return ["interpolate", ["linear"], prop, ...LI_STOPS.flat()] as ExpressionSpecification;
}

export function MapView({ samples, selectedId, grid, onSelect, onMapClick, bounds }: {
  samples: Sample[];
  bounds?: number[];
  selectedId?: string;
  grid: GridLayer;
  onSelect: (ids: string[]) => void;
  onMapClick?: (lat: number, lon: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Some school and older computers cannot draw WebGL2 maps. The sample list still works without it.
  const [failed, setFailed] = useState(() => !document.createElement("canvas").getContext("webgl2"));
  // The map's click listener is set up once, so it reads the latest callbacks through this ref.
  const handlers = useRef({ onSelect, onMapClick });
  useEffect(() => {
    handlers.current = { onSelect, onMapClick };
  });

  useEffect(() => {
    if (failed || !container.current) return;
    let m: MLMap;
    try {
      m = new MLMap({
        container: container.current,
        style: STYLE,
        bounds: [[STUDY_BOUNDS[0], STUDY_BOUNDS[1]], [STUDY_BOUNDS[2], STUDY_BOUNDS[3]]],
        fitBoundsOptions: { padding: 25 },
        attributionControl: { compact: true },
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("counties", { type: "geojson", data: "/data/arkansas-counties.geojson" });
      m.addLayer({ id: "county-lines", type: "line", source: "counties", filter: ["in", ["get", "NAME"], ["literal", STUDY_COUNTIES]], paint: { "line-color": "#799b94", "line-width": 1, "line-opacity": 0.55 } });
      m.addSource("grid", { type: "geojson", data: "/data/grid.geojson" });
      m.addLayer({
        id: "grid",
        type: "fill",
        source: "grid",
        paint: { "fill-color": liColor(["get", "usgs_pred"]), "fill-opacity": 0 },
      });
      m.addSource("domain", { type: "geojson", data: "/data/domain.geojson" });
      m.addLayer({
        id: "domain",
        type: "line",
        source: "domain",
        paint: { "line-color": "#a9b8cc", "line-width": 1.2, "line-dasharray": [3, 2] },
      });
      m.addSource("wells", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "wells-missing",
        type: "circle",
        source: "wells",
        filter: ["!", ["has", "li"]],
        paint: { "circle-radius": 3, "circle-color": "transparent", "circle-stroke-color": "#5b6b82", "circle-stroke-width": 1.2 },
      });
      m.addLayer({
        id: "wells",
        type: "circle",
        source: "wells",
        filter: ["has", "li"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 11, 8],
          "circle-color": liColor(["get", "li"]),
          "circle-stroke-color": "#08111f",
          "circle-stroke-width": 1,
        },
      });
      m.addLayer({
        id: "selected",
        type: "circle",
        source: "wells",
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 11, "circle-color": "transparent", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
      for (const layer of ["wells", "wells-missing"]) {
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
      m.on("click", (e) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["wells", "wells-missing"] });
        if (hits.length) {
          handlers.current.onSelect([...new Set(hits.map((h) => String(h.properties.id)))] as string[]);
        } else {
          handlers.current.onMapClick?.(e.lngLat.lat, e.lngLat.lng);
        }
      });
      setLoaded(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      setLoaded(false);
    };
  }, [failed]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    (m.getSource("wells") as GeoJSONSource).setData({
        type: "FeatureCollection",
        features: samples.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: { id: s.id, ...(s.chemistry.Li.value !== null ? { li: s.chemistry.Li.value } : {}) },
      })),
    });
  }, [samples, loaded]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    m.setFilter("selected", ["==", ["get", "id"], selectedId ?? ""]);
    if (grid === "none") {
      m.setPaintProperty("grid", "fill-opacity", 0);
    } else {
      m.setPaintProperty("grid", "fill-color", liColor(["coalesce", ["get", grid], 0]));
      m.setPaintProperty("grid", "fill-opacity", 0.5);
    }
  }, [selectedId, grid, loaded]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const b = bounds ?? STUDY_BOUNDS;
    m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 35, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650 });
  }, [bounds, loaded]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center p-6 text-center" role="status">
        <div className="max-w-sm">
          <p className="text-ink">This browser can&rsquo;t draw the interactive map.</p>
          <p className="mt-2 text-sm text-ink-3">
            It needs a graphics feature called WebGL2, which some school and older computers turn off. You can still
            choose a county and a measured sample from the list.
          </p>
        </div>
      </div>
    );
  }
  return <div ref={container} className="h-full w-full" role="region" aria-label="Map of Arkansas counties and recorded brine samples" />;
}
