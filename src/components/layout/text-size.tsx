"use client";

import { ALargeSmallIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { nextTextSize, TEXT_SIZE_KEY, TEXT_SIZES, toTextSize, type TextSize } from "./theme";

function read(): TextSize {
  try {
    return toTextSize(localStorage.getItem(TEXT_SIZE_KEY));
  } catch {
    return "normal";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("textsizechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("textsizechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function save(size: TextSize) {
  try {
    if (size === "normal") localStorage.removeItem(TEXT_SIZE_KEY);
    else localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    // Storage blocked (private mode): nothing to remember, the size stays as it is.
  }
  window.dispatchEvent(new Event("textsizechange"));
}

const labelOf = (size: TextSize) => TEXT_SIZES.find((s) => s.value === size)?.label ?? "Normal";

/** The chosen text size; "normal" on the server and until the page has loaded. */
function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, read, () => null) ?? "normal";
}

/** One button that steps through the sizes. Remembered on this device. */
export function TextSizeButton() {
  const size = useTextSize();
  const next = nextTextSize(size);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Text size: ${labelOf(size)}. Switch to ${labelOf(next)}`}
      title={`Text size: ${labelOf(size)}`}
      onClick={() => save(next)}
    >
      <ALargeSmallIcon />
    </Button>
  );
}

/** All the sizes side by side, for the My account screen. */
export function TextSizePicker() {
  const size = useTextSize();
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Text size" className="flex flex-wrap gap-2">
        {TEXT_SIZES.map((s) => (
          <Button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={size === s.value}
            variant={size === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => save(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Makes everything on screen bigger or smaller. It is remembered on this phone or computer only, and printed
        invoices are not changed.
      </p>
    </div>
  );
}
