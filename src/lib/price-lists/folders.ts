export interface FolderNode {
  id: number;
  name: string;
  parentId: number | null;
}

/** Returns a function that gives the full path of a folder, e.g. "Dealers › North". */
export function folderPathResolver(folders: FolderNode[]) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return (folderId: number | null): string => {
    const parts: string[] = [];
    let f = folderId != null ? byId.get(folderId) : undefined;
    for (let guard = 0; f && guard < 50; guard++) {
      parts.unshift(f.name);
      f = f.parentId != null ? byId.get(f.parentId) : undefined;
    }
    return parts.join(" › ");
  };
}

/** Natural sort by name: "Markup 5%" before "Markup 10%". */
export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/** Folders in tree order with their depth, for indented dropdowns. */
export function flattenFolders<T extends FolderNode>(folders: T[]): (T & { depth: number })[] {
  const out: (T & { depth: number })[] = [];
  const walk = (parentId: number | null, depth: number) => {
    if (depth > 50) return;
    for (const f of folders.filter((x) => x.parentId === parentId).sort(byName)) {
      out.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** One-line summary of a price rule, e.g. "Purchase +20%, 5% disc., round ₹1". */
export function describeRule(l: {
  base: string;
  adjustType: string;
  adjustPct: number;
  discountPct: number;
  roundTo: number;
}): string {
  if (l.base === "manual") return "Manual prices only";
  const base = { purchase: "Purchase", previous_purchase: "Prev. purchase", list: "List price" }[l.base] ?? l.base;
  const parts = [`${base} ${l.adjustType === "markdown" ? "−" : "+"}${l.adjustPct}%`];
  if (l.discountPct) parts.push(`${l.discountPct}% disc.`);
  if (l.roundTo) parts.push(`round ₹${l.roundTo}`);
  return parts.join(", ");
}
