import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export interface ListRow {
  label: string;
  icon?: LucideIcon;
  /** null shows the row dimmed with a "Soon" badge. */
  href: string | null;
  /** A short line under the label, e.g. what is filled in. */
  note?: string;
}

/** A rounded card of tappable rows with a chevron, like a phone settings screen. */
export function ModuleList({ title, rows }: { title?: string | null; rows: ListRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {rows.map((row) => {
          const body = (
            <>
              {row.icon && <row.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{row.label}</span>
                {row.note && <span className="truncate text-sm font-normal text-muted-foreground">{row.note}</span>}
              </span>
              {row.href == null ? (
                <Badge variant="outline">Soon</Badge>
              ) : (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </>
          );
          return (
            <li key={row.label}>
              {row.href == null ? (
                <div className="flex items-center gap-3 px-4 py-3.5 text-muted-foreground" aria-disabled>
                  {body}
                </div>
              ) : (
                <Link href={row.href} className="flex items-center gap-3 px-4 py-3.5 font-medium hover:bg-muted/60">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
