"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { THEME_KEY, type ThemeChoice } from "./theme";

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

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "Same as device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Light, dark or same as the device, side by side. Remembered on this device. */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, read, () => null) ?? "system";
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Look" className="flex flex-wrap gap-2">
        {CHOICES.map((c) => {
          const Icon = ICON[c.value];
          return (
            <Button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={current === c.value}
              variant={current === c.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                try {
                  if (c.value === "system") localStorage.removeItem(THEME_KEY);
                  else localStorage.setItem(THEME_KEY, c.value);
                } catch {
                  // Storage blocked (private mode): the change still works until the page reloads.
                }
                window.dispatchEvent(new Event("themechange"));
              }}
            >
              <Icon />
              {c.label}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">Remembered on this phone or computer only.</p>
    </div>
  );
}
