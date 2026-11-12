/** The user's choice; "system" follows the phone or computer setting. */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "theme";

/** How big the app's text is; everything else scales with it, like zooming the page. */
export type TextSize = "small" | "normal" | "large" | "xlarge";

export const TEXT_SIZE_KEY = "text-size";
export const TEXT_SIZES: { value: TextSize; label: string; scale: string }[] = [
  { value: "small", label: "Small", scale: "87.5%" },
  { value: "normal", label: "Normal", scale: "100%" },
  { value: "large", label: "Large", scale: "112.5%" },
  { value: "xlarge", label: "Extra large", scale: "125%" },
];

/** A stored value as a text size; anything unknown is "normal". */
export function toTextSize(v: unknown): TextSize {
  return TEXT_SIZES.find((s) => s.value === v)?.value ?? "normal";
}

/** The next size up, going back to the smallest after the largest. */
export function nextTextSize(size: TextSize): TextSize {
  const i = TEXT_SIZES.findIndex((s) => s.value === size);
  return TEXT_SIZES[(i + 1) % TEXT_SIZES.length].value;
}

const SCALES = JSON.stringify(Object.fromEntries(TEXT_SIZES.filter((s) => s.value !== "normal").map((s) => [s.value, s.scale])));

/**
 * Runs in <head> before the page paints, so a dark-mode user never sees a white flash.
 * It also keeps "system" in step with the device, prints in light mode, and
 * sets the chosen text size (print styles put that back to normal).
 * Kept small and self-contained: it cannot import anything.
 */
export const THEME_SCRIPT = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function choice() {
    try { return localStorage.getItem("${THEME_KEY}") || "system"; } catch (e) { return "system"; }
  }
  function apply() {
    var c = choice();
    var dark = c === "dark" || (c !== "light" && media.matches);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }
  function applySize() {
    var size;
    try { size = localStorage.getItem("${TEXT_SIZE_KEY}"); } catch (e) {}
    var scales = ${SCALES};
    root.style.fontSize = (size && Object.prototype.hasOwnProperty.call(scales, size) && scales[size]) || "";
  }
  apply();
  applySize();
  media.addEventListener("change", apply);
  window.addEventListener("storage", apply);
  window.addEventListener("storage", applySize);
  window.addEventListener("textsizechange", applySize);
  window.addEventListener("themechange", apply);
  window.addEventListener("beforeprint", function () {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  });
  window.addEventListener("afterprint", apply);
})();`;
