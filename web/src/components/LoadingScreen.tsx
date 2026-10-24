"use client";

import { useEffect, useState } from "react";

// First-visit loading screen: a lithium atom (3 electrons: 2 inner, 1 outer) while the USGS samples load.
// It stays at least 0.8 s so the animation reads, then fades out and removes itself.
export function LoadingScreen({ ready }: { ready: boolean }) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [gone, setGone] = useState(false);
  const done = ready && minTimePassed;
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!done) return;
    // Lets the welcome headline start its entrance as the loading screen fades.
    document.documentElement.dataset.loaded = "true";
    const timer = setTimeout(() => setGone(true), 650);
    return () => clearTimeout(timer);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`loading-screen${done ? " is-done" : ""}`} role="status" aria-live="polite">
      <svg className="atom" viewBox="0 0 120 120" aria-hidden>
        <circle className="atom-orbit" cx="60" cy="60" r="24" />
        <circle className="atom-orbit" cx="60" cy="60" r="46" />
        <g className="atom-inner"><circle cx="84" cy="60" r="4" /><circle cx="36" cy="60" r="4" /></g>
        <g className="atom-outer"><circle cx="106" cy="60" r="4.5" /></g>
        <circle className="atom-nucleus" cx="60" cy="60" r="9" />
      </svg>
      <p className="loading-title">Lithium <b>Lens</b></p>
      <p className="loading-text">{ready ? "Ready" : "Loading USGS brine samples from southern Arkansas…"}</p>
      <span className="loading-bar" aria-hidden><span /></span>
    </div>
  );
}
