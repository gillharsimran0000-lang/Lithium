"""
Every number the extraction model uses, with where it came from.

kind:
  "published"  - a value reported in a cited source
  "constant"   - a physical or chemical constant
  "assumption" - our stated estimate; no reliable published value was found. Shown in the app as an assumption.

Uncertain values have a (low, mode, high) range. The model's uncertainty bands come from sampling
these ranges, so a wide range here means a wide band in the app.
"""

from dataclasses import asdict, dataclass
from typing import Optional


@dataclass(frozen=True)
class Param:
    key: str
    label: str
    low: float
    mode: float
    high: float
    unit: str
    kind: str
    source: str
    note: Optional[str] = None


SOURCES = {
    "usgs_li": "Knierim and others (2024), USGS data release doi:10.5066/P9QPRYZN",
    "ldh_ugm": "Salafudin and others (2025), Indonesian Journal of Chemistry 25(4):1012-1027, doi:10.22146/ijc.97024: LiAl-LDH capacity 6.7 mg/g",
    "ldh_waterloo": "University of Waterloo (UWSpace), Development of Hydrogel/Aluminum-based Adsorbent Beads and Membranes for Lithium Extraction from Brines: LiAl-LDH capacity about 7.3 mg/g",
    "ldh_rsc": "Fang and others (2025), RSC Advances, doi:10.1039/d5ra05236j: LiAl-LDH on ZSM-5, Li/Mg selectivity 188 at pH 7 and 25 °C",
    "lmo_pmc": "Karshyga and others (2023), Materials 16:7548, doi:10.3390/ma16247548: manganese-oxide sorbent 21.2 mg/g at pH 12.06 and 18.9 mg/g at pH 10.04; cites 6.6-27 mg/g from brines and geothermal fluid",
    "lmo_ea": "Lee and others (2018), Carbon Letters 28:87-95: activation energy 22.61 kJ/mol for lithium uptake on a lithium manganese oxide electrode (electro-assisted)",
    "hto_rsc": "Dai and others (2021), RSC Advances, doi:10.1039/d1ra06535a: H2TiO3 29.73 mg/g and Al-doped H2TiO3 32.12 mg/g at pH 12 (best pH tested); Li/Mg separation factor 48.49 (Lagoco brine); Ti dissolution 2.53% (Al-doped); cites 10.55-24.5 mg/g from other studies",
    "hto_gu": "Gu and others (2018), Chemical Engineering Journal 350:474-483, as cited by Dai and others (2021): H2TiO3 Li/Mg separation factor 5441 (West Taijinel Salt Lake brine)",
    "egrid": "US EPA eGRID2023, SRMV subregion (most of Arkansas): 741.7 lb CO2e/MWh",
    "eia_price": "US EIA Electric Power Annual 2024: Arkansas industrial average 6.61 cents/kWh",
    "epa_ghg": "US EPA GHG Emission Factors Hub: natural gas 53.06 kg CO2/MMBtu",
    "crc": "CRC Handbook of Chemistry and Physics, solubility products at 25 °C",
    "sl_demo": "Standard Lithium news release, 20 Nov 2023: 96.1% average Li recovery, El Dorado demonstration plant, Jul-Aug 2023 (company-reported)",
    "vera": "Vera and others (2023), Nature Reviews Earth & Environment 4:149-165: DLE heating up to 80 °C; only ~30% of DLE tests used real brines",
    "none": "No reliable published value found; stated assumption",
}

TECHNOLOGIES = {
    "lial_ldh": {
        "name": "LiAl-LDH sorbent",
        "long_name": "Lithium-aluminum layered double hydroxide sorbent",
        "elution": "water",
        "summary": "Aluminum-based sorbent, the most mature DLE sorbent type. Works near neutral pH, so brine "
                   "usually needs no pH adjustment. Lower capacity per gram than ion sieves.",
    },
    "lmo": {
        "name": "Manganese-oxide ion sieve (LMO)",
        "long_name": "Lithium manganese oxide ion sieve, H1.6Mn1.6O4 type",
        "elution": "acid",
        "summary": "Swaps H+ for Li+, so it needs alkaline brine (best at pH 12 in the cited test) and an acid "
                   "wash to release lithium. High capacity, but manganese slowly dissolves.",
    },
    "hto": {
        "name": "Titanium-oxide ion sieve (HTO)",
        "long_name": "Hydrogen titanium oxide ion sieve, H2TiO3",
        "elution": "acid",
        "summary": "Also an H+/Li+ exchanger, needing strongly alkaline brine (best at pH 12 in the cited test). "
                   "Some published tests found it very selective against magnesium.",
    },
}

# Per-technology parameters: key -> Param. `tech` prefix keeps keys unique.
TECH_PARAMS = {
    "lial_ldh": [
        Param("qmax", "Maximum lithium capacity", 6.7, 7.0, 7.3, "mg Li per g sorbent", "published",
              "ldh_ugm + ldh_waterloo"),
        Param("alpha_mg", "Li/Mg selectivity factor", 50, 188, 400, "-", "published", "ldh_rsc",
              "Mode is the single published value (25 °C, salt-lake brine). Range is our assumption."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.02, 0.05, 0.10, "L per mg", "assumption", "none"),
        Param("ph_low", "Low end of working pH window", 5.0, 5.5, 6.0, "pH", "assumption", "ldh_rsc",
              "The published test used pH 7; the width of the window is our assumption."),
        Param("ph_high", "High end of working pH window", 8.0, 8.5, 9.0, "pH", "assumption", "ldh_rsc"),
        Param("k25", "Uptake rate at 25 °C", 0.5, 1.0, 2.0, "per hour", "assumption", "none"),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.0005, 0.001, 0.003, "fraction", "assumption", "none"),
        Param("sorbent_price", "Sorbent price", 10, 20, 40, "$ per kg", "assumption", "none"),
    ],
    "lmo": [
        Param("qmax", "Maximum lithium capacity", 6.6, 21.2, 27, "mg Li per g sorbent", "published", "lmo_pmc",
              "Mode is the cited study's best result (pH 12.06). Range spans the brine values it cites."),
        Param("alpha_mg", "Li/Mg selectivity factor", 100, 500, 2000, "-", "assumption", "none",
              "No published Li/Mg factor for this sorbent in brine was found."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.05, 0.10, 0.20, "L per mg", "assumption", "none"),
        Param("ph50", "pH where half the exchange sites are active", 8.5, 9.1, 9.5, "pH", "assumption", "lmo_pmc",
              "Fitted to the cited study: capacity at pH 10.04 was 89% of its best (pH 12.06). Range is our assumption."),
        Param("k25", "Uptake rate at 25 °C", 0.2, 0.5, 1.0, "per hour", "assumption", "lmo_pmc",
              "Published kinetics fit pseudo-second-order; we simplify to first-order."),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.0005, 0.0016, 0.005, "fraction", "assumption", "none",
              "No confirmed published per-cycle loss was found; manganese dissolution varies widely between studies."),
        Param("sorbent_price", "Sorbent price", 20, 35, 60, "$ per kg", "assumption", "none"),
    ],
    "hto": [
        Param("qmax", "Maximum lithium capacity", 10.55, 29.73, 32.12, "mg Li per g sorbent", "published", "hto_rsc",
              "Mode is plain H2TiO3 in the cited study; low end is the lowest value it cites; high end is its Al-doped version."),
        Param("alpha_mg", "Li/Mg selectivity factor", 48.49, 500, 5441, "-", "assumption", "hto_rsc + hto_gu",
              "Published values span 48.49 (Lagoco brine) to 5441 (West Taijinel brine); the most likely value is our assumption."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.05, 0.10, 0.20, "L per mg", "assumption", "none"),
        Param("ph50", "pH where half the exchange sites are active", 10.5, 11.0, 11.5, "pH", "assumption", "hto_rsc",
              "The cited study found uptake rising slowly from pH 4 and jumping at pH 12, the highest pH tested. The midpoint is our assumption."),
        Param("k25", "Uptake rate at 25 °C", 0.1, 0.3, 0.6, "per hour", "assumption", "none"),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.001, 0.005, 0.025, "fraction", "assumption", "hto_rsc",
              "High end = 2.53% Ti dissolution reported for Al-doped H2TiO3. Rest of range is our assumption."),
        Param("sorbent_price", "Sorbent price", 30, 50, 80, "$ per kg", "assumption", "none"),
    ],
}

SHARED_PARAMS = [
    Param("ea", "Activation energy of uptake", 15, 22.6, 40, "kJ per mol", "published", "lmo_ea",
          "One published value (LMO electrode with an applied voltage). Applied to all sorbents; range is our assumption."),
    Param("elution_eff", "Fraction of loaded lithium washed off", 0.90, 0.95, 0.99, "fraction", "assumption", "none"),
    Param("coprecip_loss", "Lithium trapped in hydroxide sludge (only if sludge forms)", 0.01, 0.03, 0.08,
          "fraction", "assumption", "none"),
    Param("acid_excess", "Acid used per mole of lithium eluted", 1.5, 2.0, 3.0, "mol H+ per mol Li", "assumption", "none"),
    Param("eluate_li", "Lithium concentration in the eluate", 300, 800, 1500, "mg/L", "assumption", "none"),
    Param("wash_ratio", "Wash water per volume of eluate", 0.5, 1.0, 2.0, "-", "assumption", "none"),
    Param("cp", "Brine heat capacity", 3.2, 3.4, 3.6, "kJ per kg per °C", "assumption", "none",
          "Concentrated chloride brines hold less heat than pure water (4.18)."),
    Param("heat_recovery", "Heat recovered from outgoing brine", 0.5, 0.7, 0.85, "fraction", "assumption", "none"),
    Param("boiler_eff", "Gas heater efficiency", 0.80, 0.85, 0.90, "fraction", "assumption", "none"),
    Param("e_pump", "Electricity to lift and reinject brine", 1.0, 2.0, 4.0, "kWh per m³", "assumption", "none"),
    Param("e_stage", "Electricity per sorption stage (pumps, mixing)", 0.3, 0.8, 2.0, "kWh per m³", "assumption", "none"),
    Param("grid_co2", "Arkansas grid emissions", 0.3364, 0.3364, 0.3364, "kg CO2e per kWh", "published", "egrid"),
    Param("gas_co2", "Natural gas emissions", 53.06, 53.06, 53.06, "kg CO2 per MMBtu", "published", "epa_ghg"),
    Param("elec_price", "Industrial electricity price, Arkansas", 0.0661, 0.0661, 0.0661, "$ per kWh", "published", "eia_price"),
    Param("gas_price", "Industrial natural gas price", 3.0, 4.5, 7.0, "$ per MMBtu", "assumption", "none"),
    Param("naoh_price", "Sodium hydroxide price", 350, 550, 800, "$ per tonne", "assumption", "none"),
    Param("hcl_price", "Hydrochloric acid price (100% basis)", 150, 250, 400, "$ per tonne", "assumption", "none"),
    Param("inventory_charge", "Yearly carrying cost of sorbent held in the plant", 0.10, 0.15, 0.25,
          "fraction of sorbent value per year", "assumption", "none",
          "Longer contact and higher dose need more sorbent in the plant at once; this charges for it."),
    Param("naoh_co2", "Sodium hydroxide production emissions", 0.6, 1.0, 1.5, "kg CO2e per kg", "assumption", "none"),
    Param("hcl_co2", "Hydrochloric acid production emissions", 0.5, 0.9, 1.5, "kg CO2e per kg", "assumption", "none"),
]

CONSTANTS = {
    "ksp_mgoh2": (5.61e-12, "Mg(OH)2 solubility product at 25 °C", "crc"),
    "ksp_caoh2": (5.02e-6, "Ca(OH)2 solubility product at 25 °C", "crc"),
    "R": (8.314, "Gas constant, J per mol per K", "constant"),
    "M_Li": (6.941, "Molar mass of lithium, g/mol", "constant"),
    "M_Mg": (24.305, "Molar mass of magnesium, g/mol", "constant"),
    "M_Ca": (40.078, "Molar mass of calcium, g/mol", "constant"),
    "M_NaOH": (39.997, "Molar mass of NaOH, g/mol", "constant"),
    "M_HCl": (36.461, "Molar mass of HCl, g/mol", "constant"),
    "M_MgOH2": (58.320, "Molar mass of Mg(OH)2, g/mol", "constant"),
    "M_CaOH2": (74.093, "Molar mass of Ca(OH)2, g/mol", "constant"),
    "LCE": (5.323, "kg lithium carbonate per kg lithium (73.89 / (2 x 6.941))", "constant"),
    "kJ_per_MMBtu": (1.055056e6, "kJ in one MMBtu", "constant"),
}

# Values used when a well is missing a measurement. Always reported back to the user as assumed.
FALLBACKS = {"temp_c": 60.0, "ph": 6.0, "specific_gravity": 1.15}


def source_text(source):
    return "; ".join(SOURCES.get(part, part) for part in source.split(" + "))


def all_params():
    """Flat list for the methodology page."""
    rows = []
    for tech, params in TECH_PARAMS.items():
        for p in params:
            rows.append({**asdict(p), "technology": tech, "source_text": source_text(p.source)})
    for p in SHARED_PARAMS:
        rows.append({**asdict(p), "technology": None, "source_text": source_text(p.source)})
    return rows
