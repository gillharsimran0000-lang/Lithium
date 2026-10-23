export type Ion = "Li" | "Mg" | "Ca" | "Na" | "K" | "Sr" | "Br" | "Cl" | "SO4" | "B";

export interface Measured {
  value: number | null;
  qualifier: "<" | ">" | null;
}

export interface Sample {
  id: string;
  name: string | null;
  field: string | null;
  county: string | null;
  state: string;
  formation: string | null;
  lat: number;
  lon: number;
  depth_ft: number | null;
  usgs_model_role: "train" | "holdout" | null;
  dataset: string;
  date: string | null;
  reference: string;
  chemistry: Record<Ion, Measured>;
  tds: number | null;
  ph: number | null;
  specific_gravity: number | null;
  temp_c: number | null;
  temp_note: string | null;
  coord_note: string | null;
}

export type Technology = "lial_ldh" | "lmo" | "hto";
export type Priority = "recovery" | "energy" | "cost" | "balanced";

export interface Brine {
  li: number;
  mg: number;
  ca: number;
  na?: number | null;
  tds?: number | null;
  temp_c?: number | null;
  ph?: number | null;
  specific_gravity?: number | null;
}

export interface Conditions {
  technology: Technology;
  temperature_c: number;
  ph_target: number;
  contact_time_h: number;
  sorbent_dose_g_l: number;
  stages: number;
}

export interface Band {
  p5: number;
  p50: number;
  p95: number;
}

export type MetricKey =
  | "recovery"
  | "li_recovered_g_m3"
  | "residual_li_mg_l"
  | "energy_kwh_per_kg"
  | "electricity_kwh_per_kg"
  | "heat_kwh_per_kg"
  | "water_m3_per_kg"
  | "brine_m3_per_kg"
  | "co2_kg_per_kg"
  | "cost_usd_per_kg"
  | "naoh_kg_per_kg"
  | "hcl_kg_per_kg"
  | "sludge_kg_per_kg"
  | "sorbent_kg_per_kg";

export interface Estimate {
  technology: Technology;
  conditions: Conditions;
  brine_used: { li: number; mg: number; ca: number; temp_c: number; ph: number; specific_gravity: number };
  assumed_inputs: string[];
  mg_li_ratio: number;
  central: Record<MetricKey, number> & {
    li_t_per_year: number;
    lce_t_per_year: number;
    ph_used: number;
    capacity_fraction: number;
    approach: number;
  };
  uncertainty: Record<MetricKey | "li_t_per_year", Band>;
  n_samples: number;
  sensitivity: {
    label: string;
    kind: string;
    low_value: number;
    high_value: number;
    recovery_at_low: number;
    recovery_at_high: number;
    spread: number;
  }[];
  curves: Record<"contact_time_h" | "temperature_c" | "ph_target" | "sorbent_dose_g_l", { x: number; recovery: number; cost: number }[]>;
}

export type Option = Conditions & Record<MetricKey, number> & { score?: number };

export interface Optimization {
  feasible: boolean;
  message?: string;
  priority: Priority;
  priority_label: string;
  min_recovery: number;
  assumed_inputs: string[];
  n_evaluated: number;
  n_feasible: number;
  current: Option;
  recommended: Option;
  best_by_technology: Partial<Record<Technology, Option>>;
  pareto: { technology: Technology; recovery: number; cost_usd_per_kg: number; co2_kg_per_kg: number }[];
  cloud: { technology: Technology; recovery: number; cost_usd_per_kg: number }[];
  uncertainty: {
    n_samples: number;
    p_higher_recovery: number;
    p_lower_cost: number;
    p_lower_co2: number;
    recovery_gain_p5: number;
    recovery_gain_p95: number;
  };
  reasons: string[];
  caveat: string;
}

export interface Scenario {
  id: string;
  name: string;
  wellId: string;
  wellLabel: string;
  brine: Brine;
  conditions: Conditions;
  flow_m3_day: number;
  estimate: Estimate;
  savedAt: string;
  origin: "manual" | "optimizer-current" | "optimizer-recommended";
}

export interface Param {
  key: string;
  label: string;
  low: number;
  mode: number;
  high: number;
  unit: string;
  kind: "published" | "assumption" | "constant";
  source: string;
  note: string | null;
  technology: Technology | null;
  source_text: string;
}

export interface ModelInfo {
  technologies: Record<Technology, { name: string; long_name: string; elution: string; summary: string }>;
  parameters: Param[];
  constants: Record<string, { value: number; label: string; source: string }>;
  fallbacks: Record<string, number>;
  sources: Record<string, string>;
  priorities: Record<Priority, string>;
  balanced_weights: Record<string, number>;
}

export interface MlMetrics {
  target: string;
  n_samples: number;
  n_spatial_blocks: number;
  block_size_km: number;
  chosen_model: string;
  chosen_params: Record<string, number | string>;
  results: Record<string, { spatial_cv: Score; random_cv: Score; random_cv_grouped?: Score }>;
  usgs_holdout: { usgs_model: Score; this_model: Score; n: number };
  interval: { target: number; half_width_mg_l: number; spatial_cv_coverage: number; fold_validation_coverage?: number; note?: string };
  importance: { variable: string; label: string; mae_increase_mg_l: number }[];
  observed_vs_predicted: { id: string; lat: number; lon: number; observed: number; predicted: number }[];
  data_checks?: {
    n_samples: number; n_locations: number; repeat_samples: number; repeat_locations: number; repeat_median_spread_mg_l: number;
    smackover_samples: number; other_formation_samples: number; missing_depths_filled: number; below_detection: number;
    usgs_test_wells_sharing_location: number; usgs_test_wells: number;
  };
}

export interface Score {
  mae: number;
  rmse: number;
  r2: number;
}
