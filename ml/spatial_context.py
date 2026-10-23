"""Neighbourhood geology clues computed from the USGS 2 km geology grids (no lithium values used).

Each well and each map cell gets, from the grid cell it sits in:
  - how steeply the Smackover top tilts (structural dip) and in which direction,
  - whether it sits on a structural high or low compared with the area around it,
  - average geology within about 4, 10 and 20 km.
The same function serves training wells and the prediction grid, so the live map can use them.
"""
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parent.parent
USGS = ROOT / "data" / "raw" / "usgs_smackover_li"
ROWS, COLS, CELL = 32, 90, 2000.0
LAYERS = ["smackover_alt", "smackover_thick", "smck_temp_int", "h2s_class", "buckner_thick",
          "cottonvalley_thickness", "hosston_thickness"]
RADII = {"4km": 2, "10km": 5, "20km": 10}


@lru_cache
def grid_stack():
    stack = pd.read_csv(USGS / "input" / "exvars" / "SAR_modeldomain_rasterstack.txt").replace(-9999, np.nan)
    assert len(stack) == ROWS * COLS
    return stack


def _window_mean(a, r):
    """Mean of non-missing cells in a (2r+1) x (2r+1) square around each cell."""
    valid = ~np.isnan(a)
    padded = np.pad(np.where(valid, a, 0.0), r)
    count = np.pad(valid.astype(float), r)
    total = np.zeros_like(a, dtype=float)
    n = np.zeros_like(a, dtype=float)
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            total += padded[dy:dy + ROWS, dx:dx + COLS]
            n += count[dy:dy + ROWS, dx:dx + COLS]
    with np.errstate(invalid="ignore", divide="ignore"):
        return total / n


@lru_cache
def cell_context():
    """Context clues for every grid cell, in the same row-major order as the USGS raster stack."""
    stack = grid_stack()
    out = {}
    alt = stack.smackover_alt.to_numpy(float).reshape(ROWS, COLS)
    filled = np.where(np.isnan(alt), _window_mean(alt, 3), alt)
    dy, dx = np.gradient(filled, CELL)
    out["smackover_dip_m_per_km"] = np.hypot(dx, dy) * 1000
    out["smackover_dip_east"] = dx * 1000
    out["smackover_dip_north"] = -dy * 1000
    for name in LAYERS:
        a = stack[name].to_numpy(float).reshape(ROWS, COLS)
        for label, r in RADII.items():
            mean = _window_mean(a, r)
            out[f"{name}_mean_{label}"] = mean
            if name == "smackover_alt":
                out[f"smackover_relief_{label}"] = a - mean
    facies = stack.smackover_facies.to_numpy(float).reshape(ROWS, COLS)
    for code in np.unique(facies[~np.isnan(facies)]):
        share = np.where(np.isnan(facies), np.nan, (facies == code).astype(float))
        out[f"smackover_facies_{int(code)}_share_10km"] = _window_mean(share, 5)
    return pd.DataFrame({k: v.ravel() for k, v in out.items()})


@lru_cache
def cell_production():
    """2022 Smackover brine production (S&P Global, via USGS) around each cell, on a log scale."""
    with rasterio.open(USGS / "input" / "brine" / "smackover_H2Oprod_2022.tif") as src:
        prod = src.read(1).astype(float)
    prod[prod < 0] = 0
    out = {"brine_production_log": np.log10(prod + 1)}
    for label, r in RADII.items():
        out[f"brine_production_log_{label}"] = np.log10(_window_mean(prod, r) + 1)
        out[f"brine_producing_share_{label}"] = _window_mean((prod > 0).astype(float), r)
    return pd.DataFrame({k: v.ravel() for k, v in out.items()})


def well_cells(lat, lon):
    """Row-major grid cell index for each (lat, lon) in NAD83."""
    with rasterio.open(USGS / "grid" / "SAR_modeldomain_mask.tif") as src:
        x, y = transform("EPSG:4269", src.crs, list(lon), list(lat))
        left, top = src.transform.c, src.transform.f
    col = np.clip(np.floor((np.array(x) - left) / CELL).astype(int), 0, COLS - 1)
    row = np.clip(np.floor((top - np.array(y)) / CELL).astype(int), 0, ROWS - 1)
    return row * COLS + col


def context_for_wells(df):
    return cell_context().iloc[well_cells(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())].reset_index(drop=True)


def production_for_wells(df):
    return cell_production().iloc[well_cells(df.LATITUDE.to_numpy(), df.LONGITUDE.to_numpy())].reset_index(drop=True)
