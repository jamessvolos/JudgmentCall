"use client";

import { useEffect, useRef, useState } from "react";

// A number that counts up from zero once, on first paint. SSR renders the
// final value (no-JS + SEO safe); the animation is a pure client enhancement
// and is skipped entirely under prefers-reduced-motion. Used for the /results
// headline totals — the study's pulse, arriving live.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) return;

    const duration = 950;
    let raf = 0;
    let start = 0;
    // The first frame (p=0) sets the display to 0; counting up from there
    // avoids a synchronous setState in the effect body.
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic — fast then settles
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display.toLocaleString()}
    </span>
  );
}
