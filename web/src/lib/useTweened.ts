"use client";

import { useEffect, useRef, useState } from "react";

// Glides a displayed number to its new value instead of jumping, so changes are easy to notice.
// Starts fast and settles gently (ease-out). Reduced-motion users get the new value straight away.
export function useTweened(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      current.current = from + (target - from) * (1 - Math.pow(1 - t, 4));
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}
