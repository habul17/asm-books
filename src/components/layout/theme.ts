/** The user's choice; "system" follows the phone or computer setting. */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "theme";

/**
 * Runs in <head> before the page paints, so a dark-mode user never sees a white flash.
 * It also keeps "system" in step with the device and prints in light mode.
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
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", apply);
  window.addEventListener("themechange", apply);
  window.addEventListener("beforeprint", function () {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  });
  window.addEventListener("afterprint", apply);
})();`;
