"""
Literature-based model of lithium recovery by sorbent DLE. This is NOT machine learning: no public
dataset of DLE experiments was found to train on. It is a chain of textbook chemistry steps whose
parameters come from assumptions.py.

Steps, for each sorption stage:
  1. pH adjustment. Raising pH with NaOH precipitates Mg(OH)2 and, at high pH, Ca(OH)2 (solubility products).
  2. Equilibrium. Competitive Langmuir isotherm (Li vs Mg) plus a mass balance, solved exactly as a quadratic.
  3. Kinetics. First-order approach to equilibrium; rate speeds up with temperature (Arrhenius).
Then elution efficiency and sludge losses give the lithium actually recovered.

All functions use numpy broadcasting, so `conditions` can hold one scenario or thousands (optimizer),
and `params` can hold central values or thousands of random draws (uncertainty).

Units: concentrations mg/L (= g/m³), sorbent dose g/L (= kg/m³), temperature °C, time hours.
"""

import numpy as np

from .assumptions import CONSTANTS, FALLBACKS, SHARED_PARAMS, TECH_PARAMS

C = {k: v[0] for k, v in CONSTANTS.items()}


# ---------- parameters ----------

def central_params(tech):
    return {p.key: p.mode for p in TECH_PARAMS[tech] + SHARED_PARAMS}


def sample_params(tech, n, seed):
    """Draw n plausible parameter sets from triangular (low, mode, high) distributions.

    Shared parameters use their own random stream, so two scenarios run with the same seed see the
    same electricity, acid and heat assumptions. That makes side-by-side comparisons fair.
    """
    out = {}
    for params, rng in ((TECH_PARAMS[tech], np.random.default_rng(seed)),
                        (SHARED_PARAMS, np.random.default_rng(seed + 1))):
        for p in params:
            out[p.key] = np.full(n, p.mode) if p.low == p.high else rng.triangular(p.low, p.mode, p.high, n)
    return out


def fill_brine(brine):
    """Use measured values where present; otherwise a stated fallback, reported back as assumed."""
    filled, assumed = dict(brine), []
    for key, value in FALLBACKS.items():
        if filled.get(key) is None:
            filled[key] = value
            assumed.append(key)
    for key in ("li", "mg", "ca"):
        if filled.get(key) is None:
            raise ValueError(f"Brine is missing {key}; the model cannot run without it.")
    return filled, assumed


# ---------- chemistry steps ----------

def ph_adjustment(brine, ph_target):
    """NaOH needed to reach ph_target, and the Mg/Ca that precipitates as hydroxide sludge.

    Ignores activity coefficients and brine buffering, which matter in real high-salinity brine, and uses
    25 °C constants (water and hydroxide chemistry shift at the hotter temperatures the app allows).
    Returns per litre of brine: NaOH (mol), Mg and Ca left in solution (mg/L), sludge (g).
    """
    ph0 = brine["ph"]
    ph = np.maximum(ph_target, ph0)  # only raising pH is modelled
    oh = 10.0 ** (ph - 14)
    mg0 = brine["mg"] / 1000 / C["M_Mg"]  # mol/L
    ca0 = brine["ca"] / 1000 / C["M_Ca"]
    mg_left = np.minimum(mg0, C["ksp_mgoh2"] / oh**2)
    ca_left = np.minimum(ca0, C["ksp_caoh2"] / oh**2)
    mg_ppt, ca_ppt = mg0 - mg_left, ca0 - ca_left
    naoh = (oh - 10.0 ** (ph0 - 14)) + (10.0 ** -ph0 - 10.0 ** -ph) + 2 * (mg_ppt + ca_ppt)
    return {
        "naoh_mol_l": np.maximum(naoh, 0.0),
        "mg_left": mg_left * C["M_Mg"] * 1000,
        "ca_left": ca_left * C["M_Ca"] * 1000,
        "sludge_g_l": mg_ppt * C["M_MgOH2"] + ca_ppt * C["M_CaOH2"],
        "precipitates": (mg_ppt + ca_ppt) > 1e-6,
        "ph": ph,
    }


def ph_factor(tech, ph, p):
    """Fraction of sorbent capacity usable at this pH."""
    if tech == "lial_ldh":
        # Full capacity inside the working window, falling linearly to half capacity 1.5 pH units outside it.
        below = np.clip((p["ph_low"] - ph) / 1.5, 0, 1)
        above = np.clip((ph - p["ph_high"]) / 1.5, 0, 1)
        return 1 - 0.5 * np.maximum(below, above)
    # Ion sieves: exchange sites release H+ to take Li+, so they work only when H+ is scarce.
    return 1 / (1 + 10.0 ** (p["ph50"] - ph))


def equilibrium_li(c0, dose, qmax, k_li, k_mg, mg):
    """Lithium left in solution at equilibrium (mg/L).

    Isotherm:     q = qmax * K*Ce / (1 + K*Ce + Kmg*Mg)
    Mass balance: c0 - Ce = dose * q
    Combining gives  K*Ce² + (B + dose*qmax*K - K*c0)*Ce - B*c0 = 0  with  B = 1 + Kmg*Mg,
    and the positive root is the answer.
    """
    B = 1 + k_mg * mg
    b = B + dose * qmax * k_li - k_li * c0
    return (-b + np.sqrt(b * b + 4 * k_li * B * c0)) / (2 * k_li)


def rate_constant(k25, ea_kj, temp_c):
    """Arrhenius: uptake gets faster as temperature rises."""
    return k25 * np.exp(-ea_kj * 1000 / C["R"] * (1 / (temp_c + 273.15) - 1 / 298.15))


# ---------- full evaluation ----------

def evaluate(tech, brine, cond, p):
    """Recovery, energy, water, chemicals, emissions and cost for one technology.

    brine: filled brine dict (scalars). cond: temperature_c, ph_target, contact_time_h,
    sorbent_dose_g_l, stages (scalars or arrays). p: parameter dict (scalars or arrays).
    """
    adj = ph_adjustment(brine, cond["ph_target"])
    usable = ph_factor(tech, adj["ph"], p)
    qmax = p["qmax"] * usable
    k_mg = p["k_li"] / p["alpha_mg"]
    k = rate_constant(p["k25"], p["ea"], cond["temperature_c"])
    approach = 1 - np.exp(-k * cond["contact_time_h"])

    c0 = brine["li"]
    c = np.asarray(c0, dtype=float) * np.ones_like(approach * qmax)
    stages = np.asarray(cond["stages"])
    for s in range(int(np.max(stages))):
        ce = equilibrium_li(c, cond["sorbent_dose_g_l"], qmax, p["k_li"], k_mg, adj["mg_left"])
        c = np.where(s < stages, c - approach * (c - ce), c)  # fresh sorbent each stage

    loaded = c0 - c
    sludge_loss = np.where(adj["precipitates"], p["coprecip_loss"], 0.0)
    recovered = loaded * p["elution_eff"] * (1 - sludge_loss)  # g Li per m³ brine
    recovery = recovered / c0
    li_kg_m3 = recovered / 1000

    # Energy per m³ of brine
    rho = brine["specific_gravity"] * 1000  # kg/m³
    dT = np.maximum(cond["temperature_c"] - brine["temp_c"], 0)
    heat_kj = rho * p["cp"] * dT * (1 - p["heat_recovery"]) / p["boiler_eff"]
    gas_mmbtu = heat_kj / C["kJ_per_MMBtu"]
    elec_kwh = p["e_pump"] + p["e_stage"] * stages

    # Chemicals per m³ of brine (kg)
    acid = tech != "lial_ldh"
    # Ion sieves release one H+ for each Li+ they take up; NaOH neutralizes it to hold the pH.
    released_h = loaded / 1000 / C["M_Li"] if acid else 0.0  # mol/L
    naoh_kg = (adj["naoh_mol_l"] + released_h) * C["M_NaOH"]  # mol/L x g/mol = g/L = kg/m³
    hcl_kg = (loaded / C["M_Li"] * p["acid_excess"] * C["M_HCl"] / 1000) if acid else np.zeros_like(loaded)
    sorbent_kg = cond["sorbent_dose_g_l"] * stages * p["sorbent_loss"]
    # Sorbent held in the plant at any moment, per m³/hour of brine: dose x hours in contact x stages.
    # Its yearly carrying cost is spread over the 8,760 m³ that flow through in a year.
    inventory_usd = (cond["sorbent_dose_g_l"] * cond["contact_time_h"] * stages
                     * p["sorbent_price"] * p["inventory_charge"] / 8760)

    # Fresh water for elution and washing (m³ per m³ brine)
    water_m3 = recovered / p["eluate_li"] * (1 + p["wash_ratio"])

    co2 = (elec_kwh * p["grid_co2"] + gas_mmbtu * p["gas_co2"]
           + naoh_kg * p["naoh_co2"] + hcl_kg * p["hcl_co2"])
    cost = (elec_kwh * p["elec_price"] + gas_mmbtu * p["gas_price"] + naoh_kg * p["naoh_price"] / 1000
            + hcl_kg * p["hcl_price"] / 1000 + sorbent_kg * p["sorbent_price"] + inventory_usd)

    per_kg = 1 / np.maximum(li_kg_m3, 1e-9)
    total_kwh = elec_kwh + heat_kj / 3600  # electricity + heat, both as kWh
    return {
        "recovery": recovery,
        "li_recovered_g_m3": recovered,
        "residual_li_mg_l": c,
        "energy_kwh_per_kg": total_kwh * per_kg,
        "electricity_kwh_per_kg": elec_kwh * per_kg,
        "heat_kwh_per_kg": heat_kj / 3600 * per_kg,
        "water_m3_per_kg": water_m3 * per_kg,
        "brine_m3_per_kg": per_kg,
        "co2_kg_per_kg": co2 * per_kg,
        "cost_usd_per_kg": cost * per_kg,
        "naoh_kg_per_kg": naoh_kg * per_kg,
        "hcl_kg_per_kg": hcl_kg * per_kg,
        "sludge_kg_per_kg": adj["sludge_g_l"] * per_kg,
        "sorbent_kg_per_kg": sorbent_kg * per_kg,
        "ph_used": adj["ph"],
        "capacity_fraction": usable,
        "approach": approach,
    }


SUMMARY_KEYS = ["recovery", "li_recovered_g_m3", "residual_li_mg_l", "energy_kwh_per_kg", "electricity_kwh_per_kg",
                "heat_kwh_per_kg", "water_m3_per_kg", "brine_m3_per_kg", "co2_kg_per_kg", "cost_usd_per_kg",
                "naoh_kg_per_kg", "hcl_kg_per_kg", "sludge_kg_per_kg", "sorbent_kg_per_kg"]


def to_float(x):
    return float(np.asarray(x).ravel()[0])


def estimate(brine_in, cond, flow_m3_day, n_samples=500, seed=7):
    """Central estimate, uncertainty band and sensitivity for one scenario."""
    tech = cond["technology"]
    brine, assumed = fill_brine(brine_in)
    central = evaluate(tech, brine, cond, central_params(tech))
    draws = evaluate(tech, brine, cond, sample_params(tech, n_samples, seed))

    result = {k: to_float(central[k]) for k in SUMMARY_KEYS}
    result["ph_used"] = to_float(central["ph_used"])
    result["capacity_fraction"] = to_float(central["capacity_fraction"])
    result["approach"] = to_float(central["approach"])
    result["li_t_per_year"] = result["li_recovered_g_m3"] * flow_m3_day * 365 / 1e6
    result["lce_t_per_year"] = result["li_t_per_year"] * C["LCE"]
    bands = {k: {"p5": float(np.percentile(draws[k], 5)), "p50": float(np.percentile(draws[k], 50)),
                 "p95": float(np.percentile(draws[k], 95))} for k in SUMMARY_KEYS}
    for q in ("p5", "p50", "p95"):
        bands.setdefault("li_t_per_year", {})[q] = bands["li_recovered_g_m3"][q] * flow_m3_day * 365 / 1e6

    return {
        "technology": tech,
        "conditions": cond,
        "brine_used": {k: brine[k] for k in ("li", "mg", "ca", "temp_c", "ph", "specific_gravity")},
        "assumed_inputs": assumed,
        "mg_li_ratio": brine["mg"] / brine["li"],
        "central": result,
        "uncertainty": bands,
        "n_samples": n_samples,
        "sensitivity": sensitivity(tech, brine, cond),
        "curves": curves(tech, brine, cond),
    }


def sensitivity(tech, brine, cond):
    """How far recovery moves when one input swings across its plausible range (others held fixed)."""
    base_p = central_params(tech)
    rows = []

    def swing(label, kind, lo_val, hi_val, apply):
        lo = to_float(apply(lo_val)["recovery"])
        hi = to_float(apply(hi_val)["recovery"])
        rows.append({"label": label, "kind": kind, "low_value": lo_val, "high_value": hi_val,
                     "recovery_at_low": lo, "recovery_at_high": hi, "spread": abs(hi - lo)})

    for p in TECH_PARAMS[tech] + SHARED_PARAMS:
        if p.low == p.high:
            continue
        swing(p.label, p.kind, p.low, p.high,
              lambda v, key=p.key: evaluate(tech, brine, cond, {**base_p, key: v}))

    def with_cond(key, v):
        return evaluate(tech, brine, {**cond, key: v}, base_p)

    def with_brine(key, v):
        return evaluate(tech, {**brine, key: v}, cond, base_p)

    swing("Contact time (h)", "operating", cond["contact_time_h"] * 0.5, cond["contact_time_h"] * 2,
          lambda v: with_cond("contact_time_h", v))
    swing("Sorbent dose (g/L)", "operating", cond["sorbent_dose_g_l"] * 0.5, cond["sorbent_dose_g_l"] * 2,
          lambda v: with_cond("sorbent_dose_g_l", v))
    swing("Operating temperature (°C)", "operating", max(cond["temperature_c"] - 15, 20),
          min(cond["temperature_c"] + 15, 95), lambda v: with_cond("temperature_c", v))
    swing("Brine magnesium (mg/L)", "brine", brine["mg"] * 0.5, brine["mg"] * 1.5, lambda v: with_brine("mg", v))
    swing("Brine lithium (mg/L)", "brine", brine["li"] * 0.5, brine["li"] * 1.5, lambda v: with_brine("li", v))
    rows.sort(key=lambda r: -r["spread"])
    return rows[:10]


def curves(tech, brine, cond):
    """Recovery as each operating variable is swept, for the simulator charts."""
    p = central_params(tech)
    out = {}
    sweeps = {
        "contact_time_h": np.array([0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]),
        "temperature_c": np.arange(20, 96, 5.0),
        "ph_target": np.arange(max(4.0, brine["ph"]), 12.6, 0.25),
        "sorbent_dose_g_l": np.array([1, 2, 5, 10, 15, 20, 30, 40.0]),
    }
    for key, xs in sweeps.items():
        r = evaluate(tech, brine, {**cond, key: xs}, p)
        out[key] = [{"x": float(x), "recovery": float(rv), "cost": float(cv)}
                    for x, rv, cv in zip(xs, np.broadcast_to(r["recovery"], xs.shape),
                                         np.broadcast_to(r["cost_usd_per_kg"], xs.shape))]
    return out
