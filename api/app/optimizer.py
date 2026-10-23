"""
Search operating conditions for one brine and recommend a configuration.

Method: exhaustive grid search. Every combination of technology, temperature, pH, contact time,
sorbent dose and number of stages is run through the process model (about 9,000 cases, vectorised),
then filtered and ranked by the user's priority. A grid search is slower than clever optimisers, but
it is easy to check by hand and it can never miss the best point on its own grid.

The recommendation is only as good as the process model behind it; see process_model.py.
"""

import itertools

import numpy as np

from .assumptions import TECHNOLOGIES
from .process_model import SUMMARY_KEYS, central_params, evaluate, fill_brine, sample_params

PRIORITIES = {
    "recovery": "Maximize lithium recovery",
    "energy": "Minimize energy per kg of lithium",
    "cost": "Minimize operating cost per kg of lithium",
    "balanced": "Balance recovery, cost, energy and emissions",
}
# Balanced score weights. Recovery counts most; the three costs share the rest equally.
WEIGHTS = {"recovery": 0.4, "cost_usd_per_kg": 0.2, "energy_kwh_per_kg": 0.2, "co2_kg_per_kg": 0.2}

TIMES = [0.5, 1, 2, 4, 8]
DOSES = [2, 5, 10, 20, 30]
STAGES = [1, 2, 3]


def grid_for(tech, brine):
    temps = sorted({round(brine["temp_c"])} | {t for t in range(30, 91, 10) if t > brine["temp_c"]})
    if tech == "lial_ldh":
        phs = sorted({round(brine["ph"], 2)} | {p for p in (7.0, 8.0) if p > brine["ph"]})
    else:
        phs = sorted({round(brine["ph"], 2)} | {p for p in np.arange(7.0, 12.01, 0.5) if p > brine["ph"]})
    combos = np.array(list(itertools.product(temps, phs, TIMES, DOSES, STAGES)), dtype=float)
    return {"temperature_c": combos[:, 0], "ph_target": combos[:, 1], "contact_time_h": combos[:, 2],
            "sorbent_dose_g_l": combos[:, 3], "stages": combos[:, 4].astype(int)}


def search(brine, technologies):
    rows = []
    for tech in technologies:
        cond = grid_for(tech, brine)
        out = evaluate(tech, brine, cond, central_params(tech))
        n = len(cond["temperature_c"])
        for i in range(n):
            rows.append({
                "technology": tech,
                "temperature_c": float(cond["temperature_c"][i]), "ph_target": float(cond["ph_target"][i]),
                "contact_time_h": float(cond["contact_time_h"][i]), "sorbent_dose_g_l": float(cond["sorbent_dose_g_l"][i]),
                "stages": int(cond["stages"][i]),
                **{k: float(np.broadcast_to(out[k], (n,))[i]) for k in SUMMARY_KEYS},
            })
    return rows


def rank(rows, priority, min_recovery):
    feasible = [r for r in rows if r["recovery"] >= min_recovery] if priority != "recovery" else rows
    if not feasible:
        return None, feasible
    if priority == "recovery":
        top = max(r["recovery"] for r in feasible)
        near_top = [r for r in feasible if r["recovery"] >= top - 0.005]  # within half a point, take the cheapest
        return min(near_top, key=lambda r: r["cost_usd_per_kg"]), feasible
    if priority == "energy":
        return min(feasible, key=lambda r: (r["energy_kwh_per_kg"], -r["recovery"])), feasible
    if priority == "cost":
        return min(feasible, key=lambda r: (r["cost_usd_per_kg"], -r["recovery"])), feasible

    # Balanced: scale each measure to 0-1 across the feasible options, then weight.
    def scaled(key):
        vals = np.array([r[key] for r in feasible])
        span = vals.max() - vals.min()
        return (vals - vals.min()) / span if span > 0 else np.zeros_like(vals)

    score = WEIGHTS["recovery"] * scaled("recovery")
    for key in ("cost_usd_per_kg", "energy_kwh_per_kg", "co2_kg_per_kg"):
        score -= WEIGHTS[key] * scaled(key)
    for r, s in zip(feasible, score):
        r["score"] = float(s)
    return feasible[int(np.argmax(score))], feasible


def pareto_front(rows):
    """Options where no other option is both cheaper and higher-recovery."""
    best = []
    for r in sorted(rows, key=lambda r: (r["cost_usd_per_kg"], -r["recovery"])):
        if not best or r["recovery"] > best[-1]["recovery"] + 1e-4:
            best.append(r)
    return best


def compare_with_uncertainty(brine, current, recommended, n=500, seed=11):
    """Run both scenarios over the same random assumption draws and count how often the recommendation wins."""
    a = evaluate(current["technology"], brine, current, sample_params(current["technology"], n, seed))
    b = evaluate(recommended["technology"], brine, recommended, sample_params(recommended["technology"], n, seed))
    return {
        "n_samples": n,
        "p_higher_recovery": float(np.mean(b["recovery"] > a["recovery"])),
        "p_lower_cost": float(np.mean(b["cost_usd_per_kg"] < a["cost_usd_per_kg"])),
        "p_lower_co2": float(np.mean(b["co2_kg_per_kg"] < a["co2_kg_per_kg"])),
        "recovery_gain_p5": float(np.percentile(b["recovery"] - a["recovery"], 5)),
        "recovery_gain_p95": float(np.percentile(b["recovery"] - a["recovery"], 95)),
    }


def explain(brine, cur, rec):
    """Plain-language reasons the recommendation differs, built from the model's own numbers."""
    reasons = []
    ratio = brine["mg"] / brine["li"]
    if rec["technology"] != cur["technology"]:
        reasons.append(f"Switches from {TECHNOLOGIES[cur['technology']]['name']} to "
                       f"{TECHNOLOGIES[rec['technology']]['name']}. {TECHNOLOGIES[rec['technology']]['summary']}")
    if cur["naoh_kg_per_kg"] > 1 and rec["naoh_kg_per_kg"] < cur["naoh_kg_per_kg"]:
        reasons.append(f"This brine has {brine['mg']:,.0f} mg/L magnesium ({ratio:,.0f} times its lithium). Raising its pH "
                       f"turns that magnesium into hydroxide sludge and uses sodium hydroxide: "
                       f"{cur['naoh_kg_per_kg']:,.0f} kg per kg of lithium now, {rec['naoh_kg_per_kg']:,.0f} kg recommended.")
    elif rec["naoh_kg_per_kg"] > cur["naoh_kg_per_kg"] + 1:
        reasons.append(f"Raises pH to {rec['ph_target']:.1f} so more ion-exchange sites take lithium. With "
                       f"{brine['mg']:,.0f} mg/L magnesium this costs {rec['naoh_kg_per_kg']:,.0f} kg sodium hydroxide per kg "
                       f"of lithium; the model judges the extra recovery worth it for this priority.")
    if rec["temperature_c"] > cur["temperature_c"]:
        reasons.append(f"Heats brine from {cur['temperature_c']:.0f} to {rec['temperature_c']:.0f} °C so lithium is "
                       f"taken up faster. Heat adds {rec['heat_kwh_per_kg']:,.0f} kWh per kg of lithium.")
    elif rec["temperature_c"] < cur["temperature_c"]:
        reasons.append(f"Runs at the brine's own temperature ({rec['temperature_c']:.0f} °C) instead of heating, "
                       f"saving {cur['heat_kwh_per_kg'] - rec['heat_kwh_per_kg']:,.0f} kWh of heat per kg of lithium.")
    if rec["stages"] != cur["stages"]:
        reasons.append(f"Uses {rec['stages']} sorption stage{'s' if rec['stages'] > 1 else ''} instead of {cur['stages']}. "
                       "Each stage contacts the brine with fresh sorbent and removes part of the lithium that is left.")
    if rec["contact_time_h"] != cur["contact_time_h"] or rec["sorbent_dose_g_l"] != cur["sorbent_dose_g_l"]:
        reasons.append(f"Contact time {cur['contact_time_h']:g} h → {rec['contact_time_h']:g} h and sorbent dose "
                       f"{cur['sorbent_dose_g_l']:g} → {rec['sorbent_dose_g_l']:g} g/L. More time and sorbent raise recovery "
                       "but with diminishing returns, and more sorbent means more sorbent loss.")
    if not reasons:
        reasons.append("The current configuration is already the best option on the search grid for this priority.")
    return reasons


def optimize(brine_in, current_cond, priority="balanced", min_recovery=0.7, technologies=None):
    brine, assumed = fill_brine(brine_in)
    techs = technologies or list(TECHNOLOGIES)
    rows = search(brine, techs)
    best, feasible = rank(rows, priority, min_recovery)

    cur = evaluate(current_cond["technology"], brine, current_cond, central_params(current_cond["technology"]))
    current = {**current_cond, **{k: float(np.asarray(cur[k]).ravel()[0]) for k in SUMMARY_KEYS}}
    if best is None:
        return {"feasible": False, "assumed_inputs": assumed, "current": current, "n_evaluated": len(rows),
                "message": f"No option on the search grid reached {min_recovery:.0%} recovery for this brine."}

    per_tech = {}
    for tech in techs:
        option, _ = rank([r for r in rows if r["technology"] == tech], priority, min_recovery)
        if option:
            per_tech[tech] = option
    front = pareto_front(feasible if priority != "recovery" else rows)
    return {
        "feasible": True,
        "priority": priority,
        "priority_label": PRIORITIES[priority],
        "min_recovery": min_recovery,
        "assumed_inputs": assumed,
        "n_evaluated": len(rows),
        "n_feasible": len(feasible),
        "current": current,
        "recommended": best,
        "best_by_technology": per_tech,
        "pareto": [{k: r[k] for k in ("technology", "recovery", "cost_usd_per_kg", "co2_kg_per_kg")} for r in front],
        "cloud": [{k: r[k] for k in ("technology", "recovery", "cost_usd_per_kg")} for r in rows[::7]],
        "uncertainty": compare_with_uncertainty(brine, current_cond, best),
        "reasons": explain(brine, current, best),
        "caveat": "Recommended by a literature-based model, not by experiments. Not an engineering design; "
                  "laboratory and pilot testing on this brine would be needed.",
    }
