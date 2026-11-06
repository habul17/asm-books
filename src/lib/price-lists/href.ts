export interface PriceListsParams {
  folder?: number | null;
  list?: number | null;
  q?: string;
  manual?: boolean;
  limit?: number;
  /** Open the name box ready for typing (after creating something new). */
  rename?: boolean;
}

/** Builds a link to the price lists screen, keeping only the values that are set. */
export function priceListsHref(p: PriceListsParams = {}): string {
  const params = new URLSearchParams();
  if (p.list) params.set("list", String(p.list));
  else if (p.folder) params.set("folder", String(p.folder));
  if (p.q) params.set("q", p.q);
  if (p.manual) params.set("manual", "1");
  if (p.limit) params.set("limit", String(p.limit));
  if (p.rename) params.set("rename", "1");
  const qs = params.toString();
  return qs ? `/price-lists?${qs}` : "/price-lists";
}
