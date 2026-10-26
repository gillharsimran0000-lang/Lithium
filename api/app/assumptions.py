"""
Every number the extraction model uses, with where it came from.

kind:
  "published"  - a value reported in a cited source
  "constant"   - a physical or chemical constant
  "assumption" - our estimate, based on the cited source (shown as "Assumption based on ..."). When no source
                 was found at all, the source is "none" and the app says so.

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
    "ldh_rsc": "Fang and others (2025), RSC Advances, doi:10.1039/d5ra05236j: LiAl-LDH on ZSM-5, Li/Mg selectivity 188 at pH 7 and 25 °C (pH 3 to 11 tested); first-order uptake rate 1.9-3.4 x 10^-3 per minute; water washed off 60.4% of loaded lithium; 91.9% of capacity kept after five cycles",
    "ldh_qian": "Qian and others (2023), Frontiers in Chemistry 11:1265290, doi:10.3389/fchem.2023.1265290: Li/Al-LDH composite, Langmuir constant 0.192 L/mg at 25 °C and 0.242 L/mg at 45 °C; first-order uptake rate 0.026-0.037 per minute",
    "lmo_pmc": "Karshyga and others (2023), Materials 16:7548, doi:10.3390/ma16247548: manganese-oxide sorbent 21.2 mg/g at pH 12.06 and 18.9 mg/g at pH 10.04; cites 6.6-27 mg/g from brines and geothermal fluid; first-order uptake rate 4.1 x 10^-3 per minute at 25 °C; Li/Mg partition coefficient 9.6 at pH 7.32 and 21 at pH 8.08, no magnesium uptake at pH 9.08 and above; 0.5 M HCl released 91-93% of lithium from the precursor",
    "lmo_zhu": "Zhu and others (2025), Materials 18:2373, doi:10.3390/ma18102373: H1.6Mn1.6O4 lost 3.4% of its manganese in the first acid wash and about 1% per cycle after the third cycle",
    "lmo_ea": "Lee and others (2018), Carbon Letters 28:87-95: activation energy 22.61 kJ/mol for lithium uptake on a lithium manganese oxide electrode (electro-assisted)",
    "hto_rsc": "Dai and others (2021), RSC Advances, doi:10.1039/d1ra06535a: H2TiO3 29.73 mg/g and Al-doped H2TiO3 32.12 mg/g at pH 12 (best pH tested); Li/Mg separation factor 48.49 (Lagoco brine); Langmuir constant 0.14 L/mg at 25 °C, 0.32 at 35 °C and 0.38 at 45 °C; first-order uptake rate 0.05-0.08 per minute at 25 °C; Ti dissolution 2.53% in the first cycle and 1.7% in the fifth; eluted with 0.2 M HCl; cites 10.55-24.5 mg/g from other studies",
    "hto_gu": "Gu and others (2018), Chemical Engineering Journal 350:474-483, as cited by Dai and others (2021): H2TiO3 Li/Mg separation factor 5441 (West Taijinel Salt Lake brine)",
    "cec_pilot": "Nagar and others (2024), California Energy Commission report CEC-500-2024-020, Pilot Scale Recovery of Lithium from Geothermal Brines: manganese-oxide sorbent beads ran 500 uptake and release cycles",
    "anl_lmo": "Argonne National Laboratory (2020), report ANL/CSE-20/1, Estimating the cost and energy demand of producing lithium manganese oxide for Li-ion batteries: $7 per kg (solid-state process) to $14.4 per kg (sol-gel process)",
    "marszalek": "Marszałek and others (2026), Materials 19:3780, doi:10.3390/ma19173780: DLE eluate from real oilfield brine held about 3,600 mg/L lithium",
    "patent_alumina": "US Patent 9,764,318, Porous activated alumina based sorbent for lithium extraction: column stripped with about 2 bed volumes of 6,000 mg/L LiCl (about 980 mg/L Li); outgoing stream peaked near 21,000 mg/L LiCl (about 3,400 mg/L Li)",
    "patent_mg": "US Patent 8,778,289, Method for economical extraction of lithium from solution including lithium: lithium loss to magnesium hydroxide stayed minimal when NaOH held pH between 8.5 and 10.5, and rose above that",
    "patent_lime": "US Patent 8,057,764, Production of lithium compounds directly from lithium containing brines: washed lime and soda-ash muds held 5-12% of the lithium input",
    "melinder": "Melinder (2010), Properties of Secondary Working Fluids for Indirect Systems (International Institute of Refrigeration), as implemented in CoolProp: sodium chloride brine heat capacity at 25 °C 3.56 (15 wt%), 3.42 (20 wt%) and 3.34 (23 wt%) kJ per kg per °C",
    "doe_boiler": "US Department of Energy Steam Tip Sheets #4 and #15: natural gas boiler combustion efficiency 82.8-85.7%",
    "swa_dfs": "Smackover Lithium, South West Arkansas Definitive Feasibility Study (2025), as summarized by Mining Technology: 12 brine wells with 220-660 kW pumps, plant feed up to 1,325 m³/h, total power demand 40 MW",
    "egrid": "US EPA eGRID2023, SRMV subregion (most of Arkansas): 741.7 lb CO2e/MWh",
    "eia_price": "US EIA Electric Power Annual 2024: Arkansas industrial average 6.61 cents/kWh",
    "eia_gas": "US EIA Natural Gas Industrial Price: Arkansas $7.84 per thousand cubic feet in 2024 and $9.09 in 2025, United States $4.07 in 2024; converted at 1,039 Btu per cubic foot (EIA Monthly Energy Review Table A4, 2024)",
    "epa_ghg": "US EPA GHG Emission Factors Hub: natural gas 53.06 kg CO2/MMBtu",
    "argus_naoh": "Argus chlor-alkali report (14 Nov 2025): US Gulf Coast export caustic soda as low as $340 per dry metric tonne, the lowest since July 2024",
    "intratec_hcl": "Intratec, hydrochloric acid price (United States, import, cif): $265 per tonne in September 2025 and $355 per tonne in November 2025; acid strength not stated",
    "carrying": "Cleverence, How do you calculate inventory carrying cost? (2024): carrying costs typically 15-30% of inventory value per year",
    "eurochlor": "Euro Chlor eco-profile (updated September 2022): caustic soda (100% basis) 0.66 kg CO2 per kg, European production",
    "bafa_hcl": "German BAFA, Informationsblatt CO2-Faktoren v3.3 (2025), via Climatiq: hydrochloric acid 0.51 kg CO2e per kg",
    "ademe_hcl": "ADEME Base Carbone v23.9, via Climatiq: hydrochloric acid manufacture 1.199 kg CO2e per kg",
    "crc": "CRC Handbook of Chemistry and Physics, solubility products at 25 °C",
    "sl_demo": "Standard Lithium news release, 20 Nov 2023: 96.1% average Li recovery, El Dorado demonstration plant, Jul-Aug 2023 (company-reported)",
    "vera": "Vera and others (2023), Nature Reviews Earth & Environment 4:149-165: DLE heating up to 80 °C; only ~30% of DLE tests used real brines",
    "none": "No published value was found; this is an estimate",
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
              "Mode is the single published value (25 °C, salt-lake brine). The range is an assumption based on it: about a quarter to twice that value."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.05, 0.192, 0.242, "L per mg", "published", "ldh_qian",
              "Mode is the 25 °C fit and the high end is the 45 °C fit. The low end is an assumption based on these, allowing for the other salts in real brine."),
        Param("ph_low", "Low end of working pH window", 5.0, 5.5, 6.0, "pH", "assumption", "ldh_rsc",
              "The cited study worked best at pH 7 and lost efficiency away from it; the window width is an assumption based on that."),
        Param("ph_high", "High end of working pH window", 8.0, 8.5, 9.0, "pH", "assumption", "ldh_rsc"),
        Param("k25", "Uptake rate at 25 °C", 0.11, 0.5, 2.2, "per hour", "assumption", "ldh_rsc + ldh_qian",
              "Published first-order rates are 0.11-0.20 per hour (Fang) and 1.6-2.2 per hour (Qian). The likely value is the middle of that span on a log scale."),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.001, 0.005, 0.017, "fraction", "assumption", "ldh_rsc + cec_pilot",
              "High end: the cited lab sorbent lost about 1.7% of its capacity per cycle. Lower values allow for plant sorbent lasting longer, as the 500-cycle beads in the CEC pilot did."),
        Param("sorbent_price", "Sorbent price", 7, 20, 40, "$ per kg", "assumption", "anl_lmo",
              "No published price for this sorbent was found. The low end is Argonne's cost to make a comparable lithium metal oxide; higher values allow for forming it into beads."),
    ],
    "lmo": [
        Param("qmax", "Maximum lithium capacity", 6.6, 21.2, 27, "mg Li per g sorbent", "published", "lmo_pmc",
              "Mode is the cited study's best result (pH 12.06). Range spans the brine values it cites."),
        Param("alpha_mg", "Li/Mg selectivity factor", 21, 500, 2000, "-", "assumption", "lmo_pmc + hto_rsc + hto_gu",
              "Karshyga measured 9.6 at pH 7.32 and 21 at pH 8.08, and no magnesium uptake from pH 9.08 up. The likely and high values follow the 48.49-5441 range published for the similar titanium ion sieve."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.05, 0.14, 0.38, "L per mg", "assumption", "hto_rsc",
              "No Langmuir constant for this sorbent in brine was found. The values come from the similar titanium ion sieve (0.14 at 25 °C to 0.38 at 45 °C)."),
        Param("ph50", "pH where half the exchange sites are active", 8.5, 9.1, 9.5, "pH", "assumption", "lmo_pmc",
              "Fitted to the cited study: capacity at pH 10.04 was 89% of its best (pH 12.06). The range is an assumption based on that fit."),
        Param("k25", "Uptake rate at 25 °C", 0.1, 0.25, 1.0, "per hour", "published", "lmo_pmc",
              "Mode is the cited first-order rate (4.1 x 10^-3 per minute). That study found a second-order model fit better; we simplify to first-order. The range is an assumption based on the mode."),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.002, 0.01, 0.034, "fraction", "published", "lmo_zhu + cec_pilot",
              "Mode: about 1% of manganese lost per cycle after the third cycle. High end: 3.4% in the first cycle. Low end: beads that lasted 500 cycles in the CEC pilot."),
        Param("sorbent_price", "Sorbent price", 7, 15, 40, "$ per kg", "assumption", "anl_lmo",
              "Argonne's cost to make LiMn2O4 for batteries is $7-14.4 per kg. The high end allows for acid treatment and forming it into beads."),
    ],
    "hto": [
        Param("qmax", "Maximum lithium capacity", 10.55, 29.73, 32.12, "mg Li per g sorbent", "published", "hto_rsc",
              "Mode is plain H2TiO3 in the cited study; low end is the lowest value it cites; high end is its Al-doped version."),
        Param("alpha_mg", "Li/Mg selectivity factor", 48.49, 500, 5441, "-", "assumption", "hto_rsc + hto_gu",
              "Published values span 48.49 (Lagoco brine) to 5441 (West Taijinel brine). The likely value is the middle of that span on a log scale."),
        Param("k_li", "Lithium affinity (Langmuir constant)", 0.05, 0.14, 0.38, "L per mg", "published", "hto_rsc",
              "Mode is the 25 °C fit for Al-doped H2TiO3 and the high end is the 45 °C fit. The low end is an assumption based on these, allowing for the other salts in real brine."),
        Param("ph50", "pH where half the exchange sites are active", 10.5, 11.0, 11.5, "pH", "assumption", "hto_rsc",
              "The cited study found uptake rising slowly from pH 4 and jumping at pH 12, the highest pH tested. The midpoint is an assumption based on that pH response."),
        Param("k25", "Uptake rate at 25 °C", 0.3, 1.0, 4.8, "per hour", "assumption", "hto_rsc",
              "The cited study measured 3.0-4.8 per hour (0.05-0.08 per minute) with fine powder. Lower values allow for coarser plant sorbent."),
        Param("sorbent_loss", "Sorbent lost per cycle", 0.005, 0.017, 0.0253, "fraction", "published", "hto_rsc",
              "Mode: 1.7% titanium lost in the fifth cycle. High end: 2.53% in the first. The low end is an assumption based on the falling trend."),
        Param("sorbent_price", "Sorbent price", 10, 30, 80, "$ per kg", "assumption", "anl_lmo",
              "No published price for this sorbent was found. Set from Argonne's $7-14.4 per kg for a comparable lithium metal oxide, raised for the titanium feed and acid treatment."),
    ],
}

SHARED_PARAMS = [
    Param("ea", "Activation energy of uptake", 15, 22.6, 40, "kJ per mol", "published", "lmo_ea",
          "The only published value found (LMO electrode with an applied voltage). Applied to all sorbents; the range is an assumption based on it."),
    Param("elution_eff", "Fraction of loaded lithium washed off", 0.60, 0.93, 0.99, "fraction", "assumption", "lmo_pmc + ldh_rsc + sl_demo",
          "Acid released 91-93% of lithium from the manganese precursor; one lab water wash released 60.4% from the aluminum sorbent. The high end follows Standard Lithium's 96.1% overall recovery."),
    Param("coprecip_loss", "Lithium trapped in hydroxide sludge (only if sludge forms)", 0.01, 0.03, 0.12,
          "fraction", "assumption", "patent_mg + patent_lime",
          "Little lithium is lost to magnesium hydroxide between pH 8.5 and 10.5. The high end is the 5-12% lost in lime and soda-ash muds, a harsher process."),
    Param("acid_excess", "Acid used per mole of lithium eluted", 1.5, 2.0, 3.0, "mol H+ per mol Li", "assumption", "hto_rsc + lmo_pmc",
          "Ion sieves swap one H+ for each Li+, so 1.0 is the minimum. Both lab studies eluted with far more dilute HCl than that; the plant excess is an assumption based on them."),
    Param("eluate_li", "Lithium concentration in the eluate", 1000, 2000, 3600, "mg/L", "assumption", "marszalek + patent_alumina",
          "Published eluates range from about 980 mg/L to 3,600 mg/L lithium. The likely value is the middle of that range."),
    Param("wash_ratio", "Wash water per volume of eluate", 0.5, 1.0, 2.0, "-", "assumption", "patent_alumina",
          "No published wash volume was found. The cited column used about 2 bed volumes to strip lithium, which sets the high end."),
    Param("cp", "Brine heat capacity", 3.2, 3.4, 3.6, "kJ per kg per °C", "published", "melinder",
          "Concentrated chloride brines hold less heat than pure water (4.18). The low end allows for brines saltier than the data cover."),
    Param("heat_recovery", "Heat recovered from outgoing brine", 0.5, 0.7, 0.85, "fraction", "assumption", "none"),
    Param("boiler_eff", "Gas heater efficiency", 0.80, 0.85, 0.86, "fraction", "published", "doe_boiler"),
    Param("e_pump", "Electricity to lift and reinject brine", 1.0, 2.0, 6.0, "kWh per m³", "assumption", "swa_dfs",
          "Rated pump power divided by plant feed gives 2.0-6.0 kWh/m³. Pumps rarely run at full rating, so the likely value sits at the low end."),
    Param("e_stage", "Electricity per sorption stage (pumps, mixing)", 0.3, 0.8, 2.0, "kWh per m³", "assumption", "swa_dfs",
          "No per-stage figure was found. For scale, the whole South West Arkansas plant, including refining, uses about 30 kWh/m³ (40 MW at 1,325 m³/h)."),
    Param("grid_co2", "Arkansas grid emissions", 0.3364, 0.3364, 0.3364, "kg CO2e per kWh", "published", "egrid"),
    Param("gas_co2", "Natural gas emissions", 53.06, 53.06, 53.06, "kg CO2 per MMBtu", "published", "epa_ghg"),
    Param("elec_price", "Industrial electricity price, Arkansas", 0.0661, 0.0661, 0.0661, "$ per kWh", "published", "eia_price"),
    Param("gas_price", "Industrial natural gas price", 3.92, 7.55, 8.75, "$ per MMBtu", "published", "eia_gas",
          "Mode: Arkansas 2024. High end: Arkansas 2025. Low end: U.S. 2024 average."),
    Param("naoh_price", "Sodium hydroxide price", 340, 550, 800, "$ per tonne", "assumption", "argus_naoh",
          "The cited low is an export price; delivered prices are higher, so the likely and high values sit above it."),
    Param("hcl_price", "Hydrochloric acid price (100% basis)", 265, 355, 1100, "$ per tonne", "assumption", "intratec_hcl",
          "The cited prices do not state acid strength. If they are per tonne of 31-36% acid, pure HCl costs about $1,000-1,150 per tonne, which sets the high end."),
    Param("inventory_charge", "Yearly carrying cost of sorbent held in the plant", 0.15, 0.20, 0.30,
          "fraction of sorbent value per year", "assumption", "carrying",
          "Longer contact and higher dose need more sorbent in the plant at once; this charges for it."),
    Param("naoh_co2", "Sodium hydroxide production emissions", 0.66, 1.0, 1.5, "kg CO2e per kg", "assumption", "eurochlor",
          "The low end is the European figure. Higher values allow for the more carbon-intensive U.S. grid (eGRID SRMV is 0.336 kg CO2e per kWh)."),
    Param("hcl_co2", "Hydrochloric acid production emissions", 0.51, 0.9, 1.2, "kg CO2e per kg", "assumption", "bafa_hcl + ademe_hcl",
          "Published factors are 0.51 (Germany) and 1.2 (France). The likely value is the middle of that range."),
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
# Based on the medians of the 37 USGS 2022 samples (Knierim and others, 2024): 61.7 °C, pH 5.89, specific gravity 1.19.
FALLBACKS = {"temp_c": 60.0, "ph": 6.0, "specific_gravity": 1.19}


def source_text(source):
    return "; ".join(SOURCES.get(part, part) for part in source.split(" + "))


def describe_source(p):
    text = source_text(p.source)
    return f"Assumption based on {text}" if p.kind == "assumption" and p.source != "none" else text


def all_params():
    """Flat list for the methodology page."""
    rows = []
    for tech, params in TECH_PARAMS.items():
        for p in params:
            rows.append({**asdict(p), "technology": tech, "source_text": describe_source(p)})
    for p in SHARED_PARAMS:
        rows.append({**asdict(p), "technology": None, "source_text": describe_source(p)})
    return rows
