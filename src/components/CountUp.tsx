"use client";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";

// Animates a number counting up/down to its target instead of jumping — used for
// pot size and player stacks so chip values never just "snap" to a new figure.
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [settings] = useSettings();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    if (settings.reducedMotion) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const duration = settings.fastMode ? 220 : 450;
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{display.toLocaleString("pt-PT")}</span>;
}
