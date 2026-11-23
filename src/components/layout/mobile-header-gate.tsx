"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Screens with their own big title, where the phone's top bar (logo, refresh, bell) is left out. */
const NO_TOP_BAR = ["/catalogue"];

/** Shows the phone's top bar everywhere except the screens above. */
export function MobileHeaderGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return NO_TOP_BAR.includes(pathname ?? "") ? null : children;
}
