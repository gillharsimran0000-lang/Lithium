"use client";

import { useState } from "react";
import { Card, Notice, PageHeader, Slider } from "@/components/ui";
import { useStore } from "@/lib/store";
import { num, pct, TECH_NAMES } from "@/lib/format";
import { useTweened } from "@/lib/useTweened";

// Conversions and outside figures used on this page. Each is shown with its source on the page.
const LCE_PER_LI = 5.323;          // kg lithium carbonate per kg lithium (molar masses)
const LCE_PER_EV_KG = 36.6;        // average battery-electric car, 2023 (Adamas Intelligence)
const ROYALTY = 0.025;             // Arkansas Oil and Gas Commission, May 2025, Reynolds Unit
const HOME_KWH_PER_YEAR = 10_800;  // average U.S. home electricity use (U.S. EIA)

// Dollars in the size people say out loud: thousand, million or billion.
function money(x: number) {
  if (x >= 1e9) return [`$${num(x / 1e9, 1)}`, " billion"];
  if (x >= 1e6) return [`$${num(x / 1e6, 1)}`, " million"];
  return [`$${num(x / 1e3)}`, " thousand"];
}

function Figure({ label, value, unit, note, dollars = false }: { label: string; value: number; unit?: string; note: string; dollars?: boolean }) {
  const shown = useTweened(value);
  const [main, suffix] = dollars ? money(shown) : [num(shown), unit];
  return (
    <div className="use-figure">
      <span>{label}</span>
      <strong className="num">{main}<small>{suffix}</small></strong>
      <p>{note}</p>
    </div>
  );
}

export default function UsesTool() {
  const { estimate, flow: setupFlow, well } = useStore();
  const [flow, setFlow] = useState(setupFlow);
  const [price, setPrice] = useState(17_000);
  if (!estimate) {
    return (
      <div>
        <PageHeader index="Step 4" title="What could this lithium do?" lede="Turn a recovery setup into yearly lithium, batteries, money and resources." />
        <Notice title="Run a recovery estimate first">
          This page uses your setup&rsquo;s results. <a className="underline" href="#predict">Choose a recovery option and select “See results”</a>, then come back.
        </Notice>
      </div>
    );
  }
  const c = estimate.central;
  // Same yearly formula as the recovery model: grams per cubic metre × cubic metres per day × 365 days.
  const liKg = (c.li_recovered_g_m3 * flow * 365) / 1000;
  const lceT = (liKg * LCE_PER_LI) / 1000;
  const value = lceT * price;
  const electricityKwh = c.electricity_kwh_per_kg * liKg;
  return (
    <div>
      <PageHeader
        index="Step 4"
        title="What could this lithium do?"
        lede="Your setup, scaled up to a year of running. For state and county leaders, landowners, and anyone weighing what Arkansas lithium could mean."
      />
      <p className="use-basis">
        Based on {TECH_NAMES[estimate.technology]} at {estimate.conditions.temperature_c} °C, recovering {pct(c.recovery)} of the lithium
        {well ? ` in ${well.name ?? well.id}` : ""}. Research estimate, running every day of the year.
      </p>
      <div className="use-controls">
        <Slider label="Plant size (brine processed each day)" unit="m³" min={500} max={50_000} step={500} value={flow} onChange={setFlow}
          hint="How much salty water the plant pumps up and processes each day." />
        <Slider label="Lithium carbonate price" unit="$/tonne" min={8_000} max={40_000} step={500} value={price} onChange={setPrice}
          hint="About $17,000 a tonne in late September 2026. The price changes a lot from year to year." />
      </div>
      <div className="use-figures">
        <Figure label="Lithium each year" value={lceT} unit=" t" note={`tonnes of lithium carbonate equivalent, the form batteries are made from, if all of it were converted (${num(liKg / 1000, 1)} t of lithium itself)`} />
        <Figure label="Electric-car batteries" value={(lceT * 1000) / LCE_PER_EV_KG} unit=" a year" note="at 36.6 kg of lithium carbonate in an average battery-electric car (2023)" />
        <Figure label="Value of the lithium" value={value} dollars note="what this much raw lithium is worth today at the price above. It is not a forecast of future prices or sales, and it leaves out anything made from it later, like batteries." />
        <Figure label="Royalties to mineral owners" value={value * ROYALTY} dollars note="Arkansas’s 2.5% royalty, paid to the people who own the mineral rights" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="What it would use each year" kicker="The costs that come with it">
          <dl className="use-costs">
            <div><dt>Fresh water</dt><dd className="num">{num((c.water_m3_per_kg * liKg) / 1000, 1)} <small>thousand m³</small></dd></div>
            <div><dt>Electricity</dt><dd className="num">{num(electricityKwh / 1000)} <small>MWh, like {num(electricityKwh / HOME_KWH_PER_YEAR)} homes</small></dd></div>
            <div><dt>Carbon dioxide</dt><dd className="num">{num((c.co2_kg_per_kg * liKg) / 1000)} <small>tonnes</small></dd></div>
            <div><dt>Operating cost</dt><dd className="num">${num((c.cost_usd_per_kg * liKg) / 1e6, 1)} <small>million for energy, chemicals and sorbent, not counting building the plant, labour or making lithium carbonate</small></dd></div>
          </dl>
        </Card>
        <Card title="Who could use these numbers" kicker="Beyond the lab">
          <ul className="use-audiences">
            <li><strong>State and county leaders</strong> can weigh royalties and new industry against the water and power a plant would need, and plan permits and roads around it.</li>
            <li><strong>Landowners and mineral owners</strong> can see roughly what the 2.5% royalty could be worth at different prices and plant sizes.</li>
            <li><strong>Battery and car makers</strong> can see how many batteries a U.S. supply from Arkansas brine could support, instead of importing lithium.</li>
          </ul>
        </Card>
      </div>
      <p className="source-note">
        Research estimates from this app&rsquo;s chemistry model, not company forecasts. Dollar figures are the value of the raw lithium at the chosen price on the day, not what it could sell for later. Lithium in the ground is not the same as lithium that can be recovered at a profit.
        Sources: royalty, <a href="https://www.arkansasbusiness.com/article/arkansas-lithium-royalty-rate-set-at-2-5-percent/" target="_blank" rel="noreferrer">Arkansas Business</a> (Arkansas Oil and Gas Commission, May 2025);
        lithium per car, <a href="https://www.adamasintel.com/lithium-average-phev-up-20-year-on-year/" target="_blank" rel="noreferrer">Adamas Intelligence</a>;
        price, <a href="https://epignosisinsights.com/reports/global-lithium-carbonate-price-tracker" target="_blank" rel="noreferrer">Epignosis Insights</a> and <a href="https://www.benchmarkminerals.com/lithium/prices" target="_blank" rel="noreferrer">Benchmark Mineral Intelligence</a>;
        home electricity, U.S. Energy Information Administration.
      </p>
    </div>
  );
}
