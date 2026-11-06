// Turns the rows of the supplier price-list spreadsheet into products and
// categories. Pure functions only, so the logic can be tested without a database.
//
// Spreadsheet layout (first sheet, row 1 is the header):
//   B = part number, C = HSN code, D = description, E = purchase price
// Rows with a description but no part number are category headings.

export type CellValue = unknown;

export interface RawRow {
  partNo: CellValue;
  hsn: CellValue;
  description: CellValue;
  price: CellValue;
}

export interface ParsedCategory {
  name: string;
  /** Name of the main group this category belongs to; null for a main group. */
  parent: string | null;
  sort: number;
}

export interface ParsedProduct {
  partNo: string;
  description: string;
  hsn: string | null;
  price: number | null;
  /** Main group name, if any. */
  group: string | null;
  /** Category name inside the group, if any. */
  category: string | null;
  sort: number;
}

export interface ParsedPriceList {
  categories: ParsedCategory[];
  products: ParsedProduct[];
  /** Part numbers that appeared more than once; only the first is kept. */
  duplicates: string[];
}

/** Reads a spreadsheet cell as trimmed text. */
export function cellText(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "number") {
    // 1001.0 → "1001"; 8.512309E7 → "85123090"
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v) return cellText(v.result);
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r: { text?: string }) => r.text ?? "").join("").trim();
    }
    if ("text" in v) return String(v.text).trim();
  }
  return String(value).trim();
}

/**
 * Reads a spreadsheet cell as a number; returns null when empty or not numeric.
 * Numeric cells keep full precision (10 decimals), minus floating-point noise:
 * 21.744219899999997 → 21.7442199.
 */
export function cellNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(10)) : null;
  if (value && typeof value === "object" && "result" in value) {
    return cellNumber((value as { result: unknown }).result);
  }
  const text = cellText(value).replace(/[₹,\s]/g, "");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converts raw rows into categories and products.
 *
 * Category rule: a heading immediately followed by another heading is a main
 * group; a heading followed by products is a category inside the current group.
 */
export function parsePriceListRows(rows: RawRow[]): ParsedPriceList {
  type Item =
    | { kind: "heading"; name: string }
    | { kind: "product"; partNo: string; hsn: string; description: string; price: number | null };

  const items: Item[] = [];
  for (const row of rows) {
    const partNo = cellText(row.partNo);
    const description = cellText(row.description).replace(/\s+/g, " ");
    if (!partNo && !description) continue;
    items.push(
      partNo
        ? { kind: "product", partNo, hsn: cellText(row.hsn), description, price: cellNumber(row.price) }
        : { kind: "heading", name: description },
    );
  }

  const categories: ParsedCategory[] = [];
  const categoryKeys = new Set<string>();
  const products: ParsedProduct[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  let group: string | null = null;
  let category: string | null = null;

  items.forEach((item, i) => {
    const sort = i + 1;
    if (item.kind === "heading") {
      const isGroup = items[i + 1]?.kind === "heading";
      if (isGroup) {
        group = item.name;
        category = null;
      } else {
        category = item.name;
      }
      const parent = isGroup ? null : group;
      const key = `${parent ?? ""}\u0000${item.name}`;
      if (!categoryKeys.has(key)) {
        categoryKeys.add(key);
        categories.push({ name: item.name, parent, sort });
      }
      return;
    }

    if (seen.has(item.partNo)) {
      duplicates.push(item.partNo);
      return;
    }
    seen.add(item.partNo);

    products.push({
      partNo: item.partNo,
      description: item.description || item.partNo,
      hsn: item.hsn || null,
      price: item.price != null && item.price > 0 ? item.price : null,
      group,
      category,
      sort,
    });
  });

  return { categories, products, duplicates };
}
