/** Link to the invoice list with its filters. Empty values are left out. */
export function invoicesHref({ q, status }: { q?: string; status?: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  const s = params.toString();
  return s ? `/invoices?${s}` : "/invoices";
}
