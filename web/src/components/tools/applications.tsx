"use client";

import { Card, PageHeader } from "@/components/ui";
import { num } from "@/lib/format";

// Worldwide end uses of lithium: U.S. Geological Survey, Mineral Commodity Summaries, February 2026.
const USES = [
  { name: "Batteries", share: 88, colour: "#99d9b1", what: "Electric cars, phones, laptops, power tools, and large batteries that store electricity for the power grid." },
  { name: "Ceramics and glass", share: 4, colour: "#2bb8b0", what: "Heat-resistant glass and ceramics, such as glass-ceramic stovetops and ovenware." },
  { name: "Lubricating greases", share: 2, colour: "#74b4f0", what: "Long-lasting grease that keeps car and machine parts moving smoothly." },
  { name: "Air treatment", share: 1, colour: "#e9b44c", what: "Pulling moisture or carbon dioxide out of air, for example in large cooling systems and spacecraft." },
  { name: "Steel casting", share: 1, colour: "#c9a0e8", what: "Powders that help steel flow and cool smoothly as it is cast." },
  { name: "Medicine", share: 1, colour: "#f07272", what: "A long-used medicine for bipolar disorder." },
  { name: "Other uses", share: 3, colour: "#5b6b82", what: "Smaller uses, including some aluminum alloys for aircraft." },
];
const SWA_LCE_T = 22_500;    // first-phase capacity, South West Arkansas project (Arkansas Department of Commerce, Aug 2026)
const LCE_PER_EV_KG = 36.6;  // average battery-electric car, 2023 (Adamas Intelligence)

export default function ApplicationsTool() {
  return (
    <div>
      <PageHeader
        index="Step 5"
        title="What is lithium used for?"
        lede="Almost all lithium now goes into rechargeable batteries. Here is where the rest goes, and why a U.S. source in Arkansas matters."
      />
      <div className="uses-bar" role="img" aria-label="Worldwide lithium uses: batteries 88%, ceramics and glass 4%, lubricating greases 2%, air treatment 1%, steel casting 1%, medicine 1%, other 3%">
        {USES.map((u) => <span key={u.name} style={{ flexGrow: u.share, background: u.colour }} title={`${u.name}: ${u.share}%`} />)}
      </div>
      <ul className="uses-list">
        {USES.map((u) => (
          <li key={u.name}>
            <span className="uses-swatch" style={{ background: u.colour }} />
            <strong className="num">{u.share}%</strong>
            <div><b>{u.name}</b><p>{u.what}</p></div>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Why a U.S. source matters" kicker="Where America gets lithium today">
          <ul className="use-audiences">
            <li>The United States imports more than half of the lithium it uses, mostly from <strong>Chile (54%)</strong> and <strong>Argentina (43%)</strong>.</li>
            <li>In 2025, the only commercial-scale U.S. lithium production came from a single brine operation in Nevada.</li>
            <li>Lithium from Arkansas brine would add another U.S. source, so less would need to be shipped in from other countries.</li>
          </ul>
        </Card>
        <Card title="Arkansas’s first big project" kicker="South West Arkansas project, Lafayette and Columbia counties">
          <ul className="use-audiences">
            <li>Planned to make <strong>{num(SWA_LCE_T)} tonnes</strong> of battery-quality lithium carbonate a year in its first phase. That is enough for about <strong>{num(Math.round((SWA_LCE_T * 1000) / LCE_PER_EV_KG / 1000) * 1000)} electric-car batteries</strong> a year.</li>
            <li>First commercial production is expected in <strong>2029</strong>.</li>
            <li>LG Energy Solution has agreed to buy 8,000 tonnes a year for 10 years.</li>
          </ul>
        </Card>
      </div>
      <p className="source-note">
        Sources: uses, imports and U.S. production, <a href="https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-lithium.pdf" target="_blank" rel="noreferrer">U.S. Geological Survey, Mineral Commodity Summaries 2026</a>;
        project plans, <a href="https://commerce.arkansas.gov/smackover-lithium-lg-energy-solution-south-west-arkansas/" target="_blank" rel="noreferrer">Arkansas Department of Commerce, August 2026</a>;
        lithium per car, <a href="https://www.adamasintel.com/lithium-average-phev-up-20-year-on-year/" target="_blank" rel="noreferrer">Adamas Intelligence</a>.
        Company plans can change.
      </p>
    </div>
  );
}
