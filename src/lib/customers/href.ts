export interface CustomersParams {
  q?: string;
  inactive?: boolean;
  group?: number | null;
  /** A customer id, or "new" for the new-customer form. */
  id?: number | "new" | null;
  edit?: boolean;
}

/** Builds a link to the customers screen, keeping only the values that are set. */
export function customersHref(p: CustomersParams = {}): string {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.inactive) params.set("inactive", "1");
  if (p.group) params.set("group", String(p.group));
  if (p.id) params.set("id", String(p.id));
  if (p.edit && typeof p.id === "number") params.set("edit", "1");
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}
