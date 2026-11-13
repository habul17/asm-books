import { describe, expect, it } from "vitest";

import { TEXT_SIZES, THEME_SCRIPT, toTextSize } from "./theme";

describe("text size", () => {
  it("falls back to normal for anything unknown", () => {
    expect(toTextSize("large")).toBe("large");
    expect(toTextSize(null)).toBe("normal");
    expect(toTextSize("huge")).toBe("normal");
    expect(toTextSize("__proto__")).toBe("normal");
  });

  it("names the sizes small to extra large, with medium as the default", () => {
    expect(TEXT_SIZES.map((s) => s.label)).toEqual(["Small", "Medium", "Large", "Extra large"]);
  });

  it("gives the page script every size except normal", () => {
    for (const s of TEXT_SIZES) {
      expect(THEME_SCRIPT.includes(`"${s.value}":"${s.scale}"`)).toBe(s.value !== "normal");
    }
    // The script must be valid JavaScript on its own.
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
  });
});

/** Runs the page script against a stand-in for the browser and returns the <html> element. */
function runScript(stored: Record<string, string>) {
  const listeners: Record<string, (() => void)[]> = {};
  const root = { style: { fontSize: "", colorScheme: "" }, classList: { toggle: () => {}, remove: () => {} } };
  const win = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
  };
  const storage = { getItem: (k: string) => stored[k] ?? null };
  new Function("document", "window", "localStorage", THEME_SCRIPT)({ documentElement: root }, win, storage);
  return { root, fire: (type: string) => listeners[type]?.forEach((fn) => fn()) };
}

describe("page script", () => {
  it("sets the stored text size and leaves normal alone", () => {
    expect(runScript({ "text-size": "xlarge" }).root.style.fontSize).toBe("125%");
    expect(runScript({ "text-size": "small" }).root.style.fontSize).toBe("87.5%");
    expect(runScript({}).root.style.fontSize).toBe("");
    expect(runScript({ "text-size": "toString" }).root.style.fontSize).toBe("");
  });

  it("follows a change made while the page is open", () => {
    const stored: Record<string, string> = {};
    const page = runScript(stored);
    stored["text-size"] = "large";
    page.fire("textsizechange");
    expect(page.root.style.fontSize).toBe("112.5%");
    delete stored["text-size"];
    page.fire("storage");
    expect(page.root.style.fontSize).toBe("");
  });
});

