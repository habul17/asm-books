/** What the Items list says about a part's stock. */

export type ItemStatus = "out" | "buy" | "slow" | "ok";
export type ItemsShow = "all" | "buy" | "out" | "slow";

export const ITEMS_SHOWS: { value: ItemsShow; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buy", label: "Buy soon" },
  { value: "out", label: "Out" },
  { value: "slow", label: "Slow" },
];

/** Sales over this many days set the pace for "buy soon". */
export const PACE_DAYS = 90;
/** Stock that runs out within this many days at that pace is "buy soon". */
export const BUY_SOON_DAYS = 30;

export function readShow(value: unknown): ItemsShow {
  return value === "buy" || value === "out" || value === "slow" ? value : "all";
}

/**
 * out: none left. buy: sold in the last PACE_DAYS and the stock lasts under
 * BUY_SOON_DAYS at that pace. slow: on the shelf with no sale for a long time.
 */
export function itemStatus(p: { stockQty: number; sold: number; slow: boolean }): ItemStatus {
  if (p.stockQty <= 0) return "out";
  if (p.sold > 0 && p.stockQty * PACE_DAYS < BUY_SOON_DAYS * p.sold) return "buy";
  if (p.slow) return "slow";
  return "ok";
}
