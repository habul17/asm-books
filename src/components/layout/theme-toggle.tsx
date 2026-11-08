"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { THEME_KEY, type ThemeChoice } from "./theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { system: "Theme: same as device", light: "Theme: light", dark: "Theme: dark" };
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** One button that cycles: same as device → light → dark. Remembered on this device. */
export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, () => null);
  const current = choice ?? "system";
  const Icon = ICON[current];
  const next = NEXT[current];
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`${LABEL[current]}. Switch to ${LABEL[next].slice(7)}`}
      title={LABEL[current]}
      onClick={() => {
        try {
          if (next === "system") localStorage.removeItem(THEME_KEY);
          else localStorage.setItem(THEME_KEY, next);
        } catch {
          // Storage blocked (private mode): the switch still works until the page reloads.
        }
        window.dispatchEvent(new Event("themechange"));
      }}
    >
      <Icon />
    </Button>
  );
}
