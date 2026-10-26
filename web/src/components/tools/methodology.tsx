"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Notice, PageHeader, Table } from "@/components/ui";
import { api } from "@/lib/api";
import { TECH_NAMES } from "@/lib/format";
import type { ModelInfo } from "@/lib/types";

const DATA_SOURCES = [
  {
    name: "Lithium observations, machine-learning predictions, and mass estimates from the Smackover Formation brines in southern Arkansas",
    who: "Knierim, K.J., and others, 2024. U.S. Geological Survey data release.",
    link: "https://doi.org/10.5066/P9QPRYZN",
    use: "37 brine samples collected in August 2022, the 221-sample training table and geologic variables, the model-area outline, and USGS's lithium prediction maps.",
  },
  {
    name: "U.S. Geological Survey National Produced Waters Geochemical Database, version 3.0",
    who: "Blondes, M.S., and others, 2023. U.S. Geological Survey data release.",
    link: "https://doi.org/10.5066/P9DSRCZJ",
    use: "Historical brine chemistry across Arkansas, plus neighboring records in the original model area, with sampling dates and original references.",
  },
  {
    name: "Lithium Resource in the Smackover Formation Brines of Southern Arkansas",
    who: "USGS Fact Sheet 2024-3052.",
    link: "https://pubs.usgs.gov/publication/fs20243052",
    use: "The 5.1–19.0 million tonne in-place estimate and the warning that it ignores economic feasibility.",
  },
  {
    name: "Evaluation of the lithium resource in the Smackover Formation brines of southern Arkansas using machine learning",
    who: "Knierim, K.J., and others, 2024. Science Advances 10(39).",
    link: "https://doi.org/10.1126/sciadv.adp8149",
    use: "Method of the USGS model that ours is compared against.",
  },
];

const EQUATIONS = [
  ["pH adjustment", "[OH⁻] = 10^(pH − 14);  Mg left = min(Mg₀, Ksp,Mg(OH)₂ / [OH⁻]²);  same for Ca(OH)₂\nNaOH = Δ[OH⁻] + Δ[H⁺] + 2 × (Mg + Ca precipitated) + Li taken up by ion sieves (each releases one H⁺)   (mol/L)"],
  ["Usable capacity", "ion sieves: f = 1 / (1 + 10^(pH½ − pH))      LDH: f = 1 inside its pH window, falling to 0.5 outside"],
  ["Competitive isotherm", "q = q_max·f · K·C / (1 + K·C + K_Mg·Mg),   K_Mg = K / α_Li/Mg"],
  ["Mass balance", "C₀ − C = dose × q   →   K·C² + (B + dose·q_max·f·K − K·C₀)·C − B·C₀ = 0,  B = 1 + K_Mg·Mg"],
  ["Kinetics", "approach = 1 − e^(−k·t),   k = k₂₅ · exp(−Eₐ/R · (1/T − 1/298.15))"],
  ["Stages", "C_next = C − approach × (C − C_equilibrium), with fresh sorbent each stage"],
  ["Recovery", "R = (C₀ − C_final) × elution efficiency × (1 − sludge loss) / C₀"],
  ["Heat", "Q = ρ · c_p · (T_op − T_brine) · (1 − heat recovered) / heater efficiency"],
];

export default function MethodologyPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.modelInfo().then(setInfo).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        index="09 · Research & Methodology"
        title="How every number in this app is produced"
        lede="Where the data comes from, what was done to it, which models are used, and what they cannot tell you."
      />

      <Card title="Data sources" kicker="All public, all downloaded unchanged from USGS">
        <ol className="flex flex-col gap-4">
          {DATA_SOURCES.map((d) => (
            <li key={d.link} className="text-sm">
              <a href={d.link} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                {d.name}
              </a>
              <div className="text-ink-3">{d.who}</div>
              <div className="mt-1 text-ink-2">{d.use}</div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="How the data was cleaned">
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
            <li>Kept records with valid coordinates inside the USGS southern Arkansas model area. The explorer and chemistry comparisons show the Arkansas records there. Other regions of Arkansas are future work: they have different rock layers, almost no lithium measurements, and no matching geology maps.</li>
            <li>USGS codes −9999 and −8888 mean &ldquo;not measured&rdquo;. They are shown as missing, never as zero.</li>
            <li>Values below the detection limit (&ldquo;&lt;&rdquo;) are kept and labelled &ldquo;below&rdquo;.</li>
            <li>
              Temperature: the database&apos;s combined <code className="num">TEMP</code> column is mostly the lab temperature
              when pH was measured (often 68 °F). Only the reported well temperature (<code className="num">TEMP_R</code>,
              converted from °F) is used, so most historical samples show temperature as missing.
            </li>
            <li>Some historical locations are flagged &ldquo;approximate&rdquo; by USGS; the map says so.</li>
            <li>The ML training table was rebuilt by running USGS&apos;s own preparation script, giving the same 221 samples.</li>
          </ul>
        </Card>

        <Card title="Machine learning: lithium concentration" kicker={<Badge kind="ml" />}>
          <div className="space-y-2 text-sm text-ink-2">
            <p>
              An ensemble (scikit-learn) predicts lithium (mg/L) using geological variables, relative-depth features,
              and location. The three members are selected using error on inner geographic folds.
            </p>
            <p>
              Tested with spatial block cross-validation (about 20 km blocks) so each test block is excluded from training; wells can still be close across block boundaries;
              hyperparameters chosen by nested cross-validation; compared with an average-value baseline, nearest-well
              interpolation, gradient boosting, and USGS&apos;s published model on the same test wells.
            </p>
            <p>
              <a href="#ml" className="underline">Full results and limits →</a>
            </p>
          </div>
        </Card>
      </div>

      <Card title="Recovery model" kicker={<Badge kind="model" />}>
        <div className="space-y-4 text-sm text-ink-2">
          <p>
            No public dataset of DLE experiments suitable for training was found, so recovery is calculated from chemistry
            rather than learned. Each step below is standard physical chemistry; parameters are listed in the table further down.
            The model is checked by automated tests (mass balance, solubility limits, monotonic trends, unit consistency).
          </p>
          <div className="overflow-x-auto rounded-md border border-line bg-panel-2">
            <table className="w-full text-sm">
              <tbody>
                {EQUATIONS.map(([name, eq]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-ink">{name}</td>
                    <td className="num whitespace-pre-wrap px-4 py-2.5 text-[13px] text-ink-2">{eq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong className="text-ink">Uncertainty.</strong> Each uncertain parameter has a low, most-likely and high value.
            The model runs 500 times with values drawn from triangular distributions; the app reports the 5th and 95th percentiles.
            When two scenarios are compared, both use the same draws of shared parameters, so the comparison is fair.
          </p>
          <p>
            <strong className="text-ink">Optimizer.</strong> Exhaustive grid search over technology, temperature (brine
            temperature up to 90 °C), pH, contact time (0.5–8 h), sorbent dose (2–30 g/L) and 1–3 stages: about 1,600 to 16,000 setups, depending on the sample's temperature and pH.
            Grid search was chosen because it is transparent and cannot miss the best point on its grid.
          </p>
          <p>
            <strong className="text-ink">Not modelled.</strong> Temperature effects on capacity (studies disagree), temperature effects on pH and solubility (25 °C constants are used),
            sodium and calcium competition, brine buffering, activity coefficients in concentrated brine, column hydrodynamics, sorbent fouling,
            capital costs, and refining to battery-grade product.
          </p>
        </div>
      </Card>

      <Card title="Every parameter and where it comes from">
        {error && <Notice tone="error">{error}</Notice>}
        {info ? (
          <Table
            head={["Parameter", "Applies to", "Low · likely · high", "Type", "Source"]}
            rows={info.parameters.map((p) => [
              <span key="l" className="text-ink">{p.label}<span className="block text-xs text-ink-3">{p.unit}</span></span>,
              p.technology ? TECH_NAMES[p.technology] : "All",
              <span key="v" className="num">{p.low === p.high ? p.mode : `${p.low} · ${p.mode} · ${p.high}`}</span>,
              <Badge key="k" kind={p.kind === "published" ? "published" : p.kind === "constant" ? "measured" : "assumption"}>{p.kind}</Badge>,
              <span key="s" className="text-xs">{p.source_text}{p.note ? <span className="mt-1 block text-ink-3">{p.note}</span> : null}</span>,
            ])}
          />
        ) : (
          !error && <p className="text-sm text-ink-3">Loading parameters from the model server…</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Resources versus reserves">
          <p className="text-sm text-ink-2">
            A <strong className="text-ink">resource</strong> is lithium that exists in the ground. A <strong className="text-ink">reserve</strong> is
            the part that can be produced profitably with current technology, confirmed by engineering study. The USGS 5.1–19 Mt
            figure is an in-place resource estimate. Nothing in this app should be read as an estimate of reserves.
          </p>
        </Card>
        <Card title="What would make this better">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
            <li>Published DLE experiments on Smackover brine, in a consistent format, would allow a genuinely trained recovery model.</li>
            <li>New, dated brine samples with temperature and pH measured at the wellhead.</li>
            <li>Operator data on real plant energy and water use.</li>
          </ul>
        </Card>
      </div>

    </div>
  );
}
