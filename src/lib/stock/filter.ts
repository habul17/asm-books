export interface StockRow {
  id: number;
  partNo: string;
  description: string;
  unit: string;
  photo: string | null;
  stockQty: number;
  /** Pieces on hand by purchase bill, oldest first, at that bill's price. Null for staff. */
  lots: { left: number; cost: number | null }[] | null;
  /** What the stock actually cost (each bill's pieces at its own price). Null for staff. */
  value: number | null;
  /** Some pieces have no known price, so they count as 0. */
  missingCost: boolean;
}

export type StockShow = "in" | "out" | "all";
export type StockSort = "value" | "qty" | "partNo";

const byPartNo = (a: StockRow, b: StockRow) => a.partNo.localeCompare(b.partNo, "en", { numeric: true });

/**
 * The parts to list. A search matches the start of the part number, or any
 * words of the name in any order ("relay 12v" finds "12V Relay").
 */
export function filterStock(items: StockRow[], { query, show, sort }: { query: string; show: StockShow; sort: StockSort }) {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const rows = items.filter((r) => {
    if (show === "in" && r.stockQty <= 0) return false;
    if (show === "out" && r.stockQty > 0) return false;
    if (!q) return true;
    if (r.partNo.toLowerCase().startsWith(q)) return true;
    const name = `${r.partNo} ${r.description}`.toLowerCase();
    return words.every((w) => name.includes(w));
  });
  const compare =
    sort === "value"
      ? (a: StockRow, b: StockRow) => (b.value ?? 0) - (a.value ?? 0) || byPartNo(a, b)
      : sort === "qty"
        ? (a: StockRow, b: StockRow) => b.stockQty - a.stockQty || byPartNo(a, b)
        : byPartNo;
  return rows.sort(compare);
}
