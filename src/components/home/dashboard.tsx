import { ArrowDownRightIcon, ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { formatMoney } from "@/lib/format";

/** A titled group of cards, like a section on a phone settings screen. */
export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** One headline number in a rounded card. */
export function Tile({
  label,
  value,
  note,
  href,
  negative = false,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  href: string;
  negative?: boolean;
}) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4 hover:bg-muted/60">
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      <span className={cn("truncate text-lg font-semibold tabular-nums sm:text-2xl", negative && "text-destructive")}>{value}</span>
      {note != null && <span className="truncate text-xs text-muted-foreground">{note}</span>}
    </Link>
  );
}

/** "↑ 12% vs last month"; nothing to compare when last month was zero. */
export function Change({ now, before }: { now: number; before: number }) {
  if (Math.abs(before) < 0.005) return <>Nothing to compare</>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  const Icon = pct >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{pct >= 0 ? "Up" : "Down"}</span>
      {Math.abs(pct)}% vs last month
    </span>
  );
}

export interface Row {
  label: ReactNode;
  note?: ReactNode;
  value?: ReactNode;
  href: string;
  strong?: boolean;
  negative?: boolean;
}

/** A rounded card of tappable rows with the figure on the right, like a phone settings screen. */
export function Rows({ rows, header }: { rows: Row[]; header?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {header}
      <ul className={cn("divide-y", header != null && "border-t")}>
        {rows.map((row, i) => (
          <li key={i}>
            <Link href={row.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("truncate", row.strong && "font-semibold")}>{row.label}</span>
                {row.note != null && <span className="truncate text-xs text-muted-foreground">{row.note}</span>}
              </span>
              {row.value != null && (
                <span
                  className={cn(
                    "shrink-0 text-right tabular-nums",
                    row.strong ? "font-semibold" : "font-medium",
                    row.negative && "text-destructive",
                  )}
                >
                  {row.value}
                </span>
              )}
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The big figure at the top of a Rows card. */
export function CardHead({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {note != null && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

/** One shade per age band, light (new) to dark (old), from the text colour so it suits both themes. */
const AGE_SHADES = ["bg-foreground/20", "bg-foreground/40", "bg-foreground/65", "bg-foreground"];

/** What customers owe, split by age: a bar of the bands, then one row per band. */
export function AgingCard({
  total,
  customers,
  buckets,
  href,
}: {
  total: number;
  customers: number;
  buckets: { label: string; value: number }[];
  href: string;
}) {
  const shown = buckets.filter((b) => b.value > 0);
  return (
    <Rows
      header={
        <div className="flex flex-col gap-3 pb-4">
          <CardHead
            label="Customers owe you"
            value={formatMoney(total)}
            note={`${customers} customer${customers === 1 ? "" : "s"}`}
          />
          {shown.length > 0 && (
            <div className="mx-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {buckets.map((b, i) =>
                b.value > 0 ? (
                  <span key={b.label} className={AGE_SHADES[i]} style={{ width: `${(b.value / total) * 100}%` }} />
                ) : null,
              )}
            </div>
          )}
        </div>
      }
      rows={buckets.map((b, i) => ({
        label: (
          <span className="inline-flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-sm", AGE_SHADES[i])} aria-hidden />
            {b.label} old
          </span>
        ),
        value: formatMoney(b.value),
        href,
      }))}
    />
  );
}

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const monthName = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00Z`));

/** Compact rupees for the chart's scale: ₹4.2L, ₹85K. */
function shortMoney(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}

const SERIES = [
  { key: "sales", label: "Sales", swatch: "bg-foreground" },
  { key: "purchases", label: "Purchases", swatch: "bg-muted-foreground/55" },
] as const;

/** Sales and purchases per month as paired bars, with a tooltip on each month. */
export function MonthChart({
  rows,
  href,
}: {
  rows: { month: string; sales: number; purchases: number }[];
  href: string;
}) {
  const max = Math.max(...rows.flatMap((r) => [r.sales, r.purchases]), 0);
  const height = (v: number) => (max > 0 && v > 0 ? `max(2px, ${(v / max) * 100}%)` : "0");
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", s.swatch)} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <Link href={href} className="text-sm font-medium hover:underline">
          Sales report
        </Link>
      </div>
      <div className="relative" aria-hidden>
        {max > 0 && (
          <span className="absolute -top-1 left-0 text-[11px] text-muted-foreground tabular-nums">{shortMoney(max)}</span>
        )}
        <div className="grid h-40 grid-cols-6 items-end gap-2 border-b pt-4">
          {rows.map((r) => (
            <div key={r.month} className="group relative flex h-full items-end justify-center gap-0.5">
              <span className="w-full max-w-5 rounded-t-[4px] bg-foreground" style={{ height: height(r.sales) }} />
              <span className="w-full max-w-5 rounded-t-[4px] bg-muted-foreground/55" style={{ height: height(r.purchases) }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 flex-col rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:flex">
                <span className="font-semibold">{monthName(r.month)}</span>
                <span className="tabular-nums">Sales {formatMoney(r.sales)}</span>
                <span className="tabular-nums">Purchases {formatMoney(r.purchases)}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-6 gap-2 text-center text-xs text-muted-foreground">
          {rows.map((r) => (
            <span key={r.month}>{monthName(r.month)}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Sales and purchases by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Sales</th>
            <th>Purchases</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthName(r.month)}</td>
              <td>{formatMoney(r.sales)}</td>
              <td>{formatMoney(r.purchases)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
