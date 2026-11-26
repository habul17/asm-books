import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { searchCreditNotes, type CreditNoteFilters } from "@/server/credit-notes";

export async function CreditNoteList({
  filters,
  limit,
  compact,
  title,
}: {
  filters: CreditNoteFilters;
  limit?: number;
  /** Smaller rows without the count line, for use inside another page. */
  compact?: boolean;
  /** Heading shown above a compact list; the whole list is hidden when it is empty. */
  title?: string;
}) {
  const { count, total, items } = await searchCreditNotes(filters, limit);
  if (compact && items.length === 0) return null;
  return (
    <section aria-label="Credit notes" className="flex flex-col gap-2">
      {compact && title && <h3 className="px-1 font-semibold">{title}</h3>}
      {!compact && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {count === items.length ? `${count} credit note${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
          {count > 0 && <> · total {formatMoney(total)}</>}
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No credit notes match “${filters.query}”.` : "No returns yet."}
        </p>
      ) : (
        <ul
          className={cn(
            "flex flex-col divide-y",
            compact
              ? "overflow-hidden rounded-2xl border border-foreground/5 bg-white/70 text-sm divide-foreground/[0.07] dark:bg-white/[0.06]"
              : "rounded-xl border",
          )}
        >
          {items.map((note) => (
            <li key={note.id}>
              <Link
                href={`/credit-notes/${note.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 hover:bg-muted/60",
                  "px-4 py-3",
                  note.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{compact ? <span className="font-mono text-xs">{note.number}</span> : note.customerName}</span>
                <span className={cn("text-right font-medium tabular-nums", note.status === "cancelled" && "line-through")}>
                  {formatMoney(note.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {!compact && <span className="font-mono">{note.number} · </span>}
                  {formatDate(note.date)} · against {note.invoiceNumber}
                </span>
                <span className="flex justify-end">
                  {note.status === "cancelled" ? (
                    <Badge variant="destructive">cancelled</Badge>
                  ) : (
                    <Badge variant="secondary">{note.refundType === "cash" ? "cash refund" : "credit"}</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {compact && count > items.length && (
        <p className="text-xs text-muted-foreground">Showing the latest {items.length} of {count}.</p>
      )}
    </section>
  );
}

export function CreditNoteListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
