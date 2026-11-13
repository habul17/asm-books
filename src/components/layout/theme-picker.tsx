"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { ChoiceList } from "./choice-list";
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

const CHOICES = [
  { value: "system", label: "Same as device", icon: ICON.system },
  { value: "light", label: "Light", icon: ICON.light },
  { value: "dark", label: "Dark", icon: ICON.dark },
] satisfies { value: ThemeChoice; label: string; icon: unknown }[];

function save(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked (private mode): the change still works until the page reloads.
  }
  window.dispatchEvent(new Event("themechange"));
}

/** Light, dark or same as the device, as a list. Remembered on this device. */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, read, () => null) ?? "system";
  return <ChoiceList title="Light or dark" choices={CHOICES} value={current} onChange={save} />;
}
