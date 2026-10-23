import type { Brine, Conditions, Estimate, ModelInfo, Optimization, Priority, Technology } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(`Cannot reach the model server at ${API_URL}. Is the API running?`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  estimate: (brine: Brine, conditions: Conditions, flow_m3_day: number) =>
    call<Estimate>("/recovery/estimate", { method: "POST", body: JSON.stringify({ brine, conditions, flow_m3_day }) }),
  optimize: (brine: Brine, current: Conditions, priority: Priority, min_recovery: number, technologies?: Technology[]) =>
    call<Optimization>("/optimize", {
      method: "POST",
      body: JSON.stringify({ brine, current, priority, min_recovery, technologies }),
    }),
  modelInfo: () => call<ModelInfo>("/model-info"),
  mlPredict: (lat: number, lon: number) =>
    call<{
      cell: number;
      in_domain: boolean;
      message?: string;
      prediction_mg_l?: number;
      interval_mg_l?: [number, number];
      interval_note?: string;
      usgs_prediction_mg_l?: number;
      usgs_p5_p95_mg_l?: [number, number];
    }>(`/ml/predict?lat=${lat}&lon=${lon}`),
};
