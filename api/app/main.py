"""Lithium Lens API. Run locally with:  uvicorn app.main:app --reload --port 8000  (from api/)."""

import os
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import ml_service
from .assumptions import CONSTANTS, FALLBACKS, SOURCES, TECHNOLOGIES, all_params
from .optimizer import PRIORITIES, WEIGHTS, optimize
from .process_model import estimate

app = FastAPI(title="Lithium Lens API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

Tech = Literal["lial_ldh", "lmo", "hto"]


class Brine(BaseModel):
    li: float = Field(gt=0, le=2000, description="Lithium, mg/L")
    mg: float = Field(ge=0, le=100000, description="Magnesium, mg/L")
    ca: float = Field(ge=0, le=200000, description="Calcium, mg/L")
    na: Optional[float] = Field(None, ge=0)
    tds: Optional[float] = Field(None, ge=0)
    temp_c: Optional[float] = Field(None, ge=0, le=150)
    ph: Optional[float] = Field(None, ge=2, le=12)
    specific_gravity: Optional[float] = Field(None, ge=0.95, le=1.4)


class Conditions(BaseModel):
    technology: Tech
    temperature_c: float = Field(ge=20, le=95)
    ph_target: float = Field(ge=2, le=12.5)
    contact_time_h: float = Field(gt=0, le=24)
    sorbent_dose_g_l: float = Field(gt=0, le=60)
    stages: int = Field(ge=1, le=4)


class EstimateRequest(BaseModel):
    brine: Brine
    conditions: Conditions
    flow_m3_day: float = Field(1000, gt=0, le=200000)


class OptimizeRequest(BaseModel):
    brine: Brine
    current: Conditions
    priority: Literal["recovery", "energy", "cost", "balanced"] = "balanced"
    min_recovery: float = Field(0.7, ge=0, le=0.99)
    technologies: Optional[List[Tech]] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/model-info")
def model_info():
    return {
        "technologies": TECHNOLOGIES,
        "parameters": all_params(),
        "constants": {k: {"value": v[0], "label": v[1], "source": v[2]} for k, v in CONSTANTS.items()},
        "fallbacks": FALLBACKS,
        "sources": SOURCES,
        "priorities": PRIORITIES,
        "balanced_weights": WEIGHTS,
    }


@app.post("/recovery/estimate")
def recovery_estimate(req: EstimateRequest):
    try:
        return estimate(req.brine.model_dump(), req.conditions.model_dump(), req.flow_m3_day)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.post("/optimize")
def run_optimizer(req: OptimizeRequest):
    try:
        return optimize(req.brine.model_dump(), req.current.model_dump(), req.priority, req.min_recovery,
                        req.technologies)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/ml/metrics")
def ml_metrics():
    return ml_service.metrics()


@app.get("/ml/predict")
def ml_predict(lat: float, lon: float):
    result = ml_service.predict_at(lat, lon)
    if result is None:
        raise HTTPException(404, "That point is outside the USGS southern Arkansas model area.")
    return result
