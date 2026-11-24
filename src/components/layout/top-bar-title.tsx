"use client";

import { usePathname } from "next/navigation";

import { sectionFor } from "./modules";
import { SectionTip } from "./section-tips";

/** The name of the section on screen, on the left of the phone's top bar. */
export function TopBarTitle() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section) return null;
  return (
    <p className="flex min-w-0 items-center gap-1 text-xl font-semibold">
      <span className="truncate">{section.label}</span>
      {/* The tip explains the section's main screen, so it shows only there. */}
      {pathname === section.href && <SectionTip href={section.href} />}
    </p>
  );
}
