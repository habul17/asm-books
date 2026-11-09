import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { OwnerGate } from "@/components/layout/owner-gate";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { PERIOD_PRESETS, type Period } from "@/lib/reports/period";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The period-related search params of a report page. */
export const periodParams = (params: SearchParams) => ({
  period: first(params.period),
  from: first(params.from),
  to: first(params.to),
});

/** Page title with a back arrow to the Reports screen. */
export function ReportHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Link href="/reports" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back to Reports">
          <ChevronLeftIcon />
        </Link>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      {children && <p className="pl-11 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Quick period buttons plus a from/to form. Works without JavaScript (a plain GET form). */
export function PeriodPicker({ path, period }: { path: string; period: Period }) {
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={p.value === "this-month" ? path : `${path}?period=${p.value}`}
            aria-current={period.preset === p.value ? "page" : undefined}
            className={buttonVariants({ variant: period.preset === p.value ? "default" : "outline", size: "sm" })}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form action={path} method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" name="from" required defaultValue={period.from} className="h-9 w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" name="to" required defaultValue={period.to} className="h-9 w-40" />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          Show
        </Button>
      </form>
    </div>
  );
}

export interface FigureRow {
  label: ReactNode;
  value: number;
  /** Shown smaller under the label. */
  hint?: ReactNode;
  /** Bold with a line above: a total. */
  strong?: boolean;
  /** Shown as "− ₹…": an amount taken away. */
  minus?: boolean;
}

/** A card of label / amount rows, like a statement. */
export function Figures({ title, rows }: { title?: string; rows: FigureRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>}
      <dl className="divide-y rounded-xl border">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn("flex items-start justify-between gap-3 px-4 py-2.5", r.strong && "bg-muted/50 font-semibold")}
          >
            <dt className="min-w-0">
              {r.label}
              {r.hint && <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>}
            </dt>
            <dd className={cn("shrink-0 text-right tabular-nums", r.value < 0 && "text-destructive")}>
              {r.minus && r.value !== 0 ? "− " : ""}
              {formatMoney(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function EmptyReport({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/** Wrapper every report page uses: centred column with the header first. Owner only unless `staffAllowed`. */
export function ReportPage({ children, staffAllowed = false }: { children: ReactNode; staffAllowed?: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {staffAllowed ? (
        children
      ) : (
        <OwnerGate what="see reports" fallback={<ReportSkeleton />}>
          {children}
        </OwnerGate>
      )}
    </div>
  );
}
