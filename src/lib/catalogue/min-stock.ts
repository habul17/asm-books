export const MAX_MIN_STOCK = 1_000_000;

export type MinStockResult = { value: number | null; error?: undefined } | { value?: undefined; error: string };

/** Reads the "min stock" box. Blank clears it; otherwise a number from 0 up to 3 decimals. */
export function parseMinStock(raw: unknown): MinStockResult {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return { value: null };
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return { error: "Enter a number like 5 or 2.5, or leave it blank." };
  const n = Number(text);
  if (n > MAX_MIN_STOCK) return { error: `Min stock can be at most ${MAX_MIN_STOCK.toLocaleString("en-IN")}.` };
  return { value: n };
}
