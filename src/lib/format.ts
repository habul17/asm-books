const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** ₹1,23,456.78; an em dash for missing values. */
export function formatMoney(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : inr.format(n);
}

/** 2026-11-06 → 06-11-2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** Quantity without trailing zeros: 5, 2.5, 0.125 */
export function formatQty(n: number | null | undefined): string {
  return n == null ? "—" : String(Number(n.toFixed(3)));
}
