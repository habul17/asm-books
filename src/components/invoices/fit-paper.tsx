"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** A4 width in CSS pixels (210mm at 96 per inch). */
const PAPER_WIDTH = 793.7;

/**
 * Shows a printed paper at its real A4 width, shrunk to fit a narrow screen like a PDF preview,
 * so a phone sees the same layout as the printout instead of a squeezed one. Screen only: the
 * shrinking is ignored when printing (see globals.css).
 */
export function FitPaper({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--paper-zoom", String(Math.min(1, el.clientWidth / PAPER_WIDTH)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="fit-paper">
      {children}
    </div>
  );
}
