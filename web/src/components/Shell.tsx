"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { wellLabel } from "@/lib/format";
import { LoadingScreen } from "./LoadingScreen";

export const NAV = [
  { href: "#map", label: "Explore" },
  { href: "#predict", label: "Try a setup" },
  { href: "#compare", label: "Compare" },
  { href: "#use", label: "Put it to use" },
  { href: "#questions", label: "Questions" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { well, wellsLoaded } = useStore();
  const [active, setActive] = useState("#overview");
  useEffect(() => {
    const update = () => setActive(window.location.hash || "#overview");
    update(); window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return (
    <div className="app-shell">
      <LoadingScreen ready={wellsLoaded} />
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header no-print">
        <div className="header-inner">
          <a href="#overview" className="brand" aria-label="LithiumOptimize AR home"><span className="brand-mark">Li<span>3</span></span><span>LithiumOptimize <b>AR</b><small>Arkansas lithium explorer</small></span></a>
          <div className="header-context"><span className="status-dot" />Public data. Clearer decisions.</div>
          <a className="guide-button" href="#ml">About the predictions ↗</a>
        </div>
        <nav className="section-nav" aria-label="Page sections">
          {NAV.map(item => <a key={item.href} href={item.href} aria-current={active === item.href ? "location" : undefined}>{item.label}</a>)}
        </nav>
      </header>
      <main id="main" className="page-content">{children}</main>
      <footer className="site-footer"><span>LithiumOptimize AR · Arkansas, in perspective.</span><a href="#methodology">Data & methodology ↗</a></footer>
      {well && active !== "#overview" && active !== "#map" && <div className="sample-dock no-print"><span><span className="status-dot" /><span className="text-ink-3">Working sample</span> <strong>{wellLabel(well)}</strong><span className="dock-county"> · {well.county ?? "Unknown"} County</span></span><a href="#map">Change sample ↑</a></div>}
    </div>
  );
}
