/** Link to a list page with its search and status filter. Empty values are left out. */
export function listHref(path: string, { q, status }: { q?: string; status?: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}
