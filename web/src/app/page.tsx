"use client";

import { useEffect, useState } from "react";
import { StrataArt } from "@/components/StrataArt";
import { ProcessSim } from "@/components/ProcessSim";
import UsesTool from "@/components/tools/uses";
import ApplicationsTool from "@/components/tools/applications";
import QuestionsTool from "@/components/tools/questions";
import { RecoveryStudio } from "@/components/RecoveryStudio";
import MapTool from "@/components/tools/map";
import BrineTool from "@/components/tools/brine";
import OptimizeTool from "@/components/tools/optimize";
import EnvironmentTool from "@/components/tools/environment";
import CompareTool from "@/components/tools/compare";
import MlTool from "@/components/tools/ml";
import MethodologyTool from "@/components/tools/methodology";
import { useStore } from "@/lib/store";
import { STUDY_COUNTIES } from "@/lib/studyArea";

const STEPS = [
  { id: "map", title: "Choose a sample", instruction: "Choose a county to explore, or pick a measured sample from the list. Select “Try this sample” when you’re ready." },
  { id: "predict", title: "Choose a recovery option", instruction: "Choose an option. Adjust temperature or processing time if you like, then select “See results”. Save different setups to compare." },
  { id: "compare", title: "Compare your results", instruction: "Choose two saved options. See which recovers more lithium and which uses fewer resources." },
  { id: "use", title: "Put it to use", instruction: "See what a year of your setup could mean: batteries, money, royalties, and the water and power it would use." },
  { id: "applications", title: "What it’s used for", instruction: "See where lithium ends up, from car batteries to medicine, and why a U.S. source matters." },
  { id: "questions", title: "Questions", instruction: "Read short answers to the questions people ask most about lithium in Arkansas." },
];
const NEXT_LABELS = ["Try a setup", "Compare results", "See what it could do", "What it’s used for", "Questions"];
const RESEARCH = [{id:"brine",title:"Sample chemistry"},{id:"optimize",title:"Optimizer"},{id:"environment",title:"Environmental impact"},{id:"ml",title:"ML performance"},{id:"methodology",title:"Sources & methods"}];
const VALID = new Set(["overview",...STEPS.map(s=>s.id),...RESEARCH.map(s=>s.id)]);

export default function Overview() {
  const { wells, wellsLoaded, well, scenarios } = useStore();
  const [screen, setScreen] = useState("overview");
  useEffect(() => {
    const sync = () => { const next = location.hash.slice(1) || "overview"; if (next === "main") return; setScreen(VALID.has(next) ? next : "overview"); window.scrollTo({top:0,behavior:"instant"}); };
    sync(); window.addEventListener("hashchange",sync);
    return () => window.removeEventListener("hashchange",sync);
  }, []);
  const step = STEPS.findIndex(s=>s.id===screen);
  const research = RESEARCH.some(s=>s.id===screen);
  const arkansas = wells.filter(w=>w.state.toLowerCase()==="arkansas");
  return <div className="workspace refined-workspace guided-workspace">
    {screen === "overview" && <section id="overview" className="split-screen is-home">
      <div className="split-main home-copy">
        <p className="hero-kicker"><span className="status-dot" />{STUDY_COUNTIES.length} southern Arkansas counties · {wellsLoaded ? arkansas.length.toLocaleString() : "…"} USGS sample records</p>
        <h1>Find the lithium in<br />Arkansas&rsquo;s brine.</h1>
        <p>Lithium powers batteries. Southern Arkansas has a lot of it, dissolved in salty water deep underground. Pick a real USGS sample, try a way to recover the lithium, and compare the water, energy, and cost.</p>
        <a className="primary-link home-start" href="#map">Start with a sample <span>→</span></a>
        <nav className="home-explore" aria-label="Explore the evidence">
          <span>Or explore the evidence</span>
          {RESEARCH.map(r=><a key={r.id} href={`#${r.id}`}>{r.title}</a>)}
        </nav>
        <p className="welcome-note">No chemistry background needed. <strong className="font-medium text-ink-2">Future work:</strong> other regions of Arkansas have different rock layers, almost no lithium measurements, and no published geology maps of the kind the model needs.</p>
      </div>
      <aside className="split-art"><StrataArt step={0} /></aside>
    </section>}
    {step >= 0 && <div className="split-screen is-step">
      <div className="split-main">
        <nav className="flow-stepper" aria-label="Your progress">{STEPS.map((s,i)=><a key={s.id} href={`#${s.id}`} aria-current={i===step ? "step" : undefined}><span>{i+1}</span><strong>{s.title}</strong>{s.id==="compare" && scenarios.length>0 && <small>{scenarios.length} saved</small>}</a>)}</nav>
        <div className="step-instruction"><span>Step {step+1} of {STEPS.length}</span><p>{STEPS[step].instruction}</p></div>
        {screen === "map" && <section id="map" className="guided-screen"><MapTool /></section>}
        <section id="predict" className="guided-screen" hidden={screen!=="predict"}><div className="section-heading"><div><h2>How much lithium could we recover?</h2></div><p>Start with the sample’s measurements. Choose an option to see what it could recover.</p></div><RecoveryStudio /><a href="#optimize" className="quiet-link optimizer-link">Help me find a better setup ↗</a></section>
        {screen === "compare" && <section id="compare" className="guided-screen"><CompareTool /></section>}
        {screen === "use" && <section id="use" className="guided-screen"><UsesTool /></section>}
        {screen === "applications" && <section id="applications" className="guided-screen"><ApplicationsTool /></section>}
        {screen === "questions" && <section id="questions" className="guided-screen"><QuestionsTool /></section>}
        <div className="flow-footer"><a href={step===0 ? "#overview" : `#${STEPS[step-1].id}`} className="secondary-link">← {step===0 ? "Home" : "Back"}</a><p>{step===0 ? (well ? "Sample selected. Ready for the next step." : "Choose a measured sample to continue.") : step===1 ? `${scenarios.length} setup${scenarios.length===1 ? "" : "s"} saved. Save two to compare.` : ["Your scenarios are stored in this browser.", "Change the plant size or price to explore.", "Next: questions people ask.", "That’s the whole tour. Try another setup, or explore the evidence from the home page."][step-2]}</p>{step<STEPS.length-1 ? <a className="primary-link" href={`#${STEPS[step+1].id}`}>{NEXT_LABELS[step]} <span>→</span></a> : <a className="primary-link" href="#overview">Back to home <span>↗</span></a>}</div>
      </div>
      <aside className={`split-art${screen==="predict" ? " is-sim" : ""}`}>{screen==="predict" ? <ProcessSim /> : <StrataArt step={Math.min(step+1, 3)} />}</aside>
    </div>}
    {research && <section className="research-screen screen-enter"><div className="research-top"><a className="quiet-link" href="#overview">← Home</a><a className="quiet-link" href="#map">Start the guided steps →</a></div><nav className="research-tabs" aria-label="Research tools">{RESEARCH.map(r=><a href={`#${r.id}`} key={r.id} aria-current={r.id===screen ? "page" : undefined}>{r.title}</a>)}</nav><div id={screen} className="research-content">{screen==="brine" && <BrineTool />}{screen==="optimize" && <OptimizeTool />}{screen==="environment" && <EnvironmentTool />}{screen==="ml" && <MlTool />}{screen==="methodology" && <><MethodologyTool /><p className="source-note">Only records inside the USGS southern Arkansas study area are shown. Missing records do not mean zero lithium. The rock cross-section is a simplified drawing, not to scale. County boundaries: <a href="https://github.com/plotly/datasets/blob/master/geojson-counties-fips.json" target="_blank" rel="noreferrer">Census-derived GeoJSON via Plotly</a>.</p></>}</div></section>}
  </div>;
}
