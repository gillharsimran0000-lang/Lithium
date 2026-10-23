"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";

// Plain answers to the questions a neighbour, a reporter or a state leader would ask. One answer shows at a time.
const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: "Where exactly is the lithium?",
    a: <>It is dissolved in very salty water, called brine, inside a rock layer called the Smackover Formation. That layer sits about 2.4 kilometres (1.5 miles) under southern Arkansas. This app covers the nine counties the U.S. Geological Survey studied: Bradley, Calhoun, Columbia, Hempstead, Lafayette, Miller, Nevada, Ouachita and Union.</>,
  },
  {
    q: "How much lithium is there?",
    a: <>The U.S. Geological Survey estimates 5 to 19 million tonnes of lithium in the Smackover brine of southern Arkansas (2024). That is lithium in the ground. Only part of it can be pumped up and recovered at a profit, so the amount that is actually produced will be smaller.</>,
  },
  {
    q: "Is this a mine?",
    a: <>Not an open-pit mine. Brine is pumped up through wells, a capture material pulls the lithium out (this is called direct lithium extraction), and the brine is pumped back underground. Companies in southern Arkansas already pump this same brine to make bromine.</>,
  },
  {
    q: "Is there lithium ore in Arkansas?",
    a: <>No. Around the world, lithium comes from three main kinds of deposits: hard-rock ore that is mined and crushed (mostly in Australia), salty water under desert salt flats that is left to evaporate in large ponds for months (Chile and Argentina), and clay that is dug up (a project at Thacker Pass, Nevada). Arkansas&rsquo;s lithium is a fourth kind: brine deep in old oil-field rock. It is pumped up through wells and the lithium is captured directly, with no open pits or evaporation ponds.</>,
  },
  {
    q: "Does it use a lot of water?",
    a: <>Some. Fresh water is used to wash the lithium off the capture material and rinse it. In this app&rsquo;s starting setup, that is about 2,500 litres of fresh water for each kilogram of lithium. The <a href="#use">Put it to use</a> step adds it up for a full year, so you can compare it with what a plant would produce.</>,
  },
  {
    q: "What are the risks to the environment?",
    a: <>A plant needs electricity and chemicals, which means carbon dioxide and waste to handle, and the brine has to be pumped back underground safely. This app estimates energy, fresh water, chemicals and carbon dioxide for each setup. It does not cover leaks, earthquakes, land use or traffic. Those need studies of a real site.</>,
  },
  {
    q: "Who gets paid?",
    a: <>In May 2025, the Arkansas Oil and Gas Commission set a 2.5% royalty on the value of the lithium for the first project. It goes to the people who own the mineral rights under the land, often local landowners. Companies, their workers and suppliers would earn money from running the plants.</>,
  },
  {
    q: "When will Arkansas start producing lithium?",
    a: <>The first large project, the South West Arkansas project in Lafayette and Columbia counties, expects its first commercial production in 2029. Its first phase is planned to make 22,500 tonnes of lithium carbonate a year (Arkansas Department of Commerce, August 2026). Company plans can change.</>,
  },
  {
    q: "How accurate is this app?",
    a: <>The machine-learning model that predicts lithium from geology scores about 0.8 both when random wells are hidden and when whole regions are hidden, and 0.96 on the U.S. Geological Survey&rsquo;s own test wells, where the USGS model scores 0.93 (1 would be perfect). It shows which regions are richer in lithium, not exact values at a single well. The recovery numbers come from a chemistry model built from published studies, not from tests on these brines. They are research estimates. See <a href="#ml">ML performance</a> for details.</>,
  },
  {
    q: "Why only southern Arkansas?",
    a: <>The lithium-rich Smackover brine is under southern Arkansas. Other regions have different rock layers, almost no lithium measurements, and no published geology maps of the kind the model needs. Covering them is future work: it would need new brine samples and new mapping first.</>,
  },
  {
    q: "Where does the data come from?",
    a: <>Real brine samples from the U.S. Geological Survey: 37 collected in 2022 and historical records from 1965 to 2018. The chemistry model uses published research, and every number it relies on is listed on <a href="#methodology">Sources &amp; methods</a>.</>,
  },
];

export default function QuestionsTool() {
  const [open, setOpen] = useState(0);
  const next = (open + 1) % QUESTIONS.length;
  // On narrow screens the answer sits below the list, so bring it into view after a tap.
  function show(i: number) {
    setOpen(i);
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => document.getElementById("faq-answer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
  return (
    <div>
      <PageHeader index="Step 6" title="Questions people ask" lede="Short, plain answers. Pick a question to read its answer." />
      <div className="faq">
        <ol className="faq-list">
          {QUESTIONS.map((item, i) => (
            <li key={item.q}>
              <button type="button" aria-pressed={open === i} aria-controls="faq-answer" onClick={() => show(i)}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>{item.q}
              </button>
            </li>
          ))}
        </ol>
        <section id="faq-answer" className="faq-answer" aria-live="polite" key={open}>
          <span className="faq-count num">Question {open + 1} of {QUESTIONS.length}</span>
          <h3>{QUESTIONS[open].q}</h3>
          <p>{QUESTIONS[open].a}</p>
          <button type="button" className="secondary-link" onClick={() => show(next)}>Next question: {QUESTIONS[next].q} →</button>
        </section>
      </div>
    </div>
  );
}
