"use client";

import { useSyncExternalStore } from "react";

import { ChoiceList } from "./choice-list";
import { TEXT_SIZE_KEY, TEXT_SIZES, toTextSize, type TextSize } from "./theme";

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

/** The chosen text size; "normal" on the server and until the page has loaded. */
function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, read, () => null) ?? "normal";
}

/** All the sizes as a list, for the Settings screen. */
export function TextSizePicker() {
  const size = useTextSize();
  return (
    <ChoiceList
      title="Text size"
      note="Makes everything on screen bigger or smaller. Printed bills are not changed."
      choices={TEXT_SIZES}
      value={size}
      onChange={save}
    />
  );
}
