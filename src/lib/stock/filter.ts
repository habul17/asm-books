export interface StockRow {
  id: number;
  partNo: string;
  description: string;
  unit: string;
  photo: string | null;
  stockQty: number;
  /** Cost of one unit (the newest purchase price). Null for staff, or when never bought. */
  cost: number | null;
  /** Stock × cost. Parts below zero count as 0, as on the Home screen. Null for staff. */
  value: number | null;
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
