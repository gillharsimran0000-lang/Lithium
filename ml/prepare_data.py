"""
Build the app's data files from the original USGS downloads.

Inputs (data/raw, downloaded unchanged from USGS ScienceBase):
  usgs_smackover_li/   Knierim and others (2024), doi:10.5066/P9QPRYZN
  usgs_pwgd_v3/        USGS National Produced Waters Geochemical Database v3.0, doi:10.5066/P9DSRCZJ

Outputs (data/processed):
  wells.json            Arkansas samples statewide, plus neighboring samples inside the USGS model domain
  domain.geojson        outline of the USGS Smackover model domain
  usgs_grid.json        USGS random-forest lithium predictions (2 km cells) with 5th/50th/95th percentiles
  usgs_ml_input.csv     the 221-sample table USGS used to train their model

Nothing here invents values. Missing measurements stay null.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
import shapefile
from shapely.geometry import Point, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
USGS = RAW / "usgs_smackover_li"

# Chemistry fields carried into the app, all in mg/L.
IONS = ["Li", "Mg", "Ca", "Na", "K", "Sr", "Br", "Cl", "SO4", "B"]

PWGD_CITATION = (
    "Blondes, M.S., and others, 2023, U.S. Geological Survey National Produced Waters "
    "Geochemical Database v3.0: U.S. Geological Survey data release, doi:10.5066/P9DSRCZJ"
)
AR2022_CITATION = (
    "Knierim, K.J., and others, 2024, Lithium observations, machine-learning predictions, and mass "
    "estimates from the Smackover Formation brines in southern Arkansas: U.S. Geological Survey "
    "data release, doi:10.5066/P9QPRYZN"
)


def parse_value(raw):
    """Turn a lab value into (number, qualifier).

    qualifier is "<" for below the detection limit, ">" for above the reporting range,
    or None for an ordinary measurement. USGS uses -9999 and -8888 for "not measured".
    """
    if raw is None or (isinstance(raw, float) and np.isnan(raw)):
        return None, None
    text = str(raw).strip()
    qualifier = None
    if text[:1] in "<>":
        qualifier, text = text[0], text[1:]
    try:
        value = float(text)
    except ValueError:
        return None, None
    if value <= -8888:
        return None, None
    return value, qualifier


def f_to_c(temp_f):
    return None if temp_f is None else round((temp_f - 32) * 5 / 9, 1)


def load_domain():
    reader = shapefile.Reader(str(USGS / "grid" / "SAR_modeldomain_4269"))
    cells = [shape(s.__geo_interface__) for s in reader.shapes()]
    return unary_union(cells).buffer(0)


def sample_record(row, dataset, ions, temp_c, temp_note, date, reference, coord_note):
    chemistry = {}
    for ion in IONS:
        value, qualifier = ions.get(ion, (None, None))
        chemistry[ion] = {"value": value, "qualifier": qualifier}
    tds, _ = parse_value(row.get("TDS"))
    ph, _ = parse_value(row.get("PH"))
    sg, _ = parse_value(row.get("SG"))
    return {
        "dataset": dataset,
        "date": date,
        "reference": reference,
        "chemistry": chemistry,
        "tds": tds,
        "ph": ph,
        "specific_gravity": sg,
        "temp_c": temp_c,
        "temp_note": temp_note,
        "coord_note": coord_note,
    }


def build_wells(domain):
    inside = prep(domain)
    used = pd.read_csv(USGS / "output" / "SAR_Lipreds.csv", encoding="utf-8-sig", dtype={"SITEID": str})
    usgs_split = dict(zip(used.SITEID, used.mtype))

    # Historical samples (1965-2018) from the Produced Waters database.
    pw = pd.read_excel(RAW / "usgs_pwgd_v3" / "USGS_NPWGDv3_excel.xlsx", dtype={"IDUSGS": str})
    pw = pw[pw.STATE.isin(["Arkansas", "Louisiana"])]
    pw = pw[pw.LONGITUDE.between(-180, 180) & pw.LATITUDE.between(-90, 90)]
    pw = pw[[state == "Arkansas" or inside.contains(Point(x, y))
             for state, x, y in zip(pw.STATE, pw.LONGITUDE, pw.LATITUDE)]]

    wells = []
    for _, row in pw.iterrows():
        ions = {ion: parse_value(row.get(ion)) for ion in IONS}
        if all(v is None for v, _ in ions.values()) and pd.isna(row.get("TDS")):
            continue
        temp_r, _ = parse_value(row.get("TEMP_R"))
        date = None if pd.isna(row.get("DATESAMPLE")) else str(row["DATESAMPLE"])[:10]
        coord_note = None if pd.isna(row.get("COORDAPX")) else str(row["COORDAPX"])
        sample = sample_record(
            row, "USGS Produced Waters Database v3", ions,
            f_to_c(temp_r), "reported well temperature" if temp_r is not None else None,
            date, f"{row['REFERENCE']} via {PWGD_CITATION}", coord_note,
        )
        wells.append(well_entry(row, sample, row["IDUSGS"], usgs_split))

    # New samples collected by USGS in August 2022 and analyzed at the USGS BRInE lab.
    ar = pd.read_csv(USGS / "input" / "usgs_southAR" / "southAR_brines_2022.txt", dtype=str)
    for _, row in ar.iterrows():
        ions = {ion: parse_value(row.get(ion)) for ion in IONS}
        temp, _ = parse_value(row.get("TEMP"))
        month, day, year = row["DATESAMPLE"].split("/")
        sample = sample_record(
            row, "USGS 2022 southern Arkansas sampling", ions,
            temp, "wellhead temperature" if temp is not None else None,
            f"{year}-{int(month):02d}-{int(day):02d}", AR2022_CITATION, None,
        )
        wells.append(well_entry(row, sample, row["SITEID"], usgs_split))

    return wells


def text(value):
    """Text field, or None when blank or USGS's -9999 "no value" code."""
    if value is None or pd.isna(value) or str(value).strip() in ("", "-9999", "-9999.0"):
        return None
    return str(value)


def well_entry(row, sample, sample_id, usgs_split):
    depth, _ = parse_value(row.get("DEPTHLOWER"))
    return {
        "id": str(sample_id),
        "name": text(row.get("WELLNAME")),
        "field": text(row.get("FIELD")),
        "county": text(row.get("COUNTY")),
        "state": str(row["STATE"]),
        "formation": text(row.get("FORMATION")),
        "lat": round(float(row["LATITUDE"]), 5),
        "lon": round(float(row["LONGITUDE"]), 5),
        "depth_ft": depth,
        "usgs_model_role": usgs_split.get(str(sample_id)),  # "train", "holdout", or None
        **sample,
    }


def build_usgs_grid():
    """Read the USGS prediction rasters into a list of 2 km cells (WGS84 corner coordinates)."""
    reader = shapefile.Reader(str(USGS / "grid" / "SAR_modeldomain_4269"))
    polygons = [s.points for s in reader.shapes()]
    layers = {}
    for key, name in [("pred", "smackover_Li_preds"), ("p5", "smackover_Li_uncertainty_p5"),
                      ("p50", "smackover_Li_uncertainty_p50"), ("p95", "smackover_Li_uncertainty_p95"),
                      ("likelihood", "smackover_Li_uncertainty_qualunc")]:
        with rasterio.open(USGS / "output" / f"{name}.tif") as src:
            layers[key] = src.read(1).ravel()
    cells = []
    # Raster cells and shapefile records are both stored row by row from the upper-left corner.
    for i, ring in enumerate(polygons):
        if layers["pred"][i] < 0:  # -99 marks cells USGS masked out
            continue
        cells.append({
            "cell": i,
            "ring": [[round(x, 5), round(y, 5)] for x, y in ring],
            **{k: float(v[i]) for k, v in layers.items()},
        })
    return cells


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    domain = load_domain()
    (OUT / "domain.geojson").write_text(json.dumps({
        "type": "Feature",
        "properties": {"name": "USGS Smackover lithium model domain", "source": AR2022_CITATION},
        "geometry": json.loads(json.dumps(domain.simplify(0.002).__geo_interface__)),
    }))

    wells = build_wells(domain)
    (OUT / "wells.json").write_text(json.dumps(wells, separators=(",", ":")))
    with_li = sum(1 for w in wells if w["chemistry"]["Li"]["value"] is not None)
    print(f"wells.json: {len(wells)} samples, {with_li} with measured lithium")

    cells = build_usgs_grid()
    (OUT / "usgs_grid.json").write_text(json.dumps(cells, separators=(",", ":")))
    print(f"usgs_grid.json: {len(cells)} cells")


if __name__ == "__main__":
    main()
