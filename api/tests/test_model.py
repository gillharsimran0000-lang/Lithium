"""Checks that the extraction model obeys basic chemistry and arithmetic. Run: pytest (from api/)."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.process_model import C, central_params, equilibrium_li, evaluate, ph_adjustment

BRINE = {"li": 56.7, "mg": 2210, "ca": 29900, "temp_c": 61.7, "ph": 5.9, "specific_gravity": 1.17}
COND = {"technology": "lial_ldh", "temperature_c": 61.7, "ph_target": 5.9, "contact_time_h": 2,
        "sorbent_dose_g_l": 10, "stages": 1}


def run(tech="lial_ldh", brine=None, **changes):
    return evaluate(tech, {**BRINE, **(brine or {})}, {**COND, "technology": tech, **changes}, central_params(tech))


def test_equilibrium_satisfies_mass_balance_and_isotherm():
    c0, dose, qmax, k, kmg, mg = 100.0, 10.0, 7.0, 0.05, 0.05 / 188, 2000.0
    ce = equilibrium_li(c0, dose, qmax, k, kmg, mg)
    q = qmax * k * ce / (1 + k * ce + kmg * mg)
    assert c0 - ce == pytest.approx(dose * q, rel=1e-9)
    assert 0 < ce < c0


def test_recovery_between_zero_and_one():
    for tech, ph in [("lial_ldh", 5.9), ("lmo", 11), ("hto", 10)]:
        r = float(run(tech, ph_target=ph)["recovery"])
        assert 0 < r < 1


def test_more_time_and_sorbent_never_lower_recovery():
    assert run(contact_time_h=4)["recovery"] >= run(contact_time_h=1)["recovery"]
    assert run(sorbent_dose_g_l=20)["recovery"] >= run(sorbent_dose_g_l=5)["recovery"]
    assert run(stages=3)["recovery"] >= run(stages=1)["recovery"]


def test_more_magnesium_lowers_recovery():
    assert run(brine={"mg": 8000})["recovery"] < run(brine={"mg": 500})["recovery"]


def test_magnesium_precipitates_only_above_its_solubility_limit():
    mg_mol = BRINE["mg"] / 1000 / C["M_Mg"]
    ph_onset = 14 + np.log10(np.sqrt(C["ksp_mgoh2"] / mg_mol))
    assert ph_adjustment(BRINE, ph_onset - 0.1)["sludge_g_l"] == pytest.approx(0, abs=1e-9)
    assert ph_adjustment(BRINE, ph_onset + 0.5)["sludge_g_l"] > 0


def test_naoh_at_least_covers_precipitated_magnesium():
    adj = ph_adjustment(BRINE, 11.0)
    mg_ppt = BRINE["mg"] / 1000 / C["M_Mg"] - adj["mg_left"] / 1000 / C["M_Mg"]
    assert adj["naoh_mol_l"] >= 2 * mg_ppt


def test_no_heat_energy_at_brine_temperature():
    assert float(run()["heat_kwh_per_kg"]) == 0
    assert float(run(temperature_c=80)["heat_kwh_per_kg"]) > 0


def test_per_kg_figures_consistent_with_recovered_mass():
    r = run()
    kg_per_m3 = float(r["li_recovered_g_m3"]) / 1000
    assert float(r["brine_m3_per_kg"]) == pytest.approx(1 / kg_per_m3)


def test_api_estimate_and_optimize():
    client = TestClient(app)
    body = {"brine": BRINE, "conditions": COND, "flow_m3_day": 1000}
    est = client.post("/recovery/estimate", json=body).json()
    u = est["uncertainty"]["recovery"]
    assert u["p5"] <= est["central"]["recovery"] <= u["p95"] + 0.02
    opt = client.post("/optimize", json={"brine": BRINE, "current": COND, "priority": "balanced"}).json()
    assert opt["feasible"] and opt["recommended"]["recovery"] >= 0.7


def test_missing_measurements_are_reported_as_assumed():
    client = TestClient(app)
    brine = {k: v for k, v in BRINE.items() if k not in ("temp_c", "ph")}
    est = client.post("/recovery/estimate", json={"brine": brine, "conditions": COND}).json()
    assert set(est["assumed_inputs"]) == {"temp_c", "ph"}
