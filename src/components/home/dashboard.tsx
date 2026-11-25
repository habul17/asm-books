import { ArrowDownRightIcon, ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { formatMoney } from "@/lib/format";

/** A titled group of cards, with a large heading like an iPhone settings screen. */
export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** Sizes of a tile's figure: "lg" for the day's two headline numbers, "md" for the rest. */
const TILE_VALUE = { lg: "text-xl sm:text-3xl", md: "text-lg sm:text-2xl" } as const;

/** One headline number on a glass card. */
export function Tile({
  label,
  value,
  note,
  badge,
  href,
  negative = false,
  size = "md",
}: {
  label: string;
  value: string;
  /** Grey line under the figure. */
  note?: ReactNode;
  /** A small pill under the figure, e.g. the change since last month. */
  badge?: ReactNode;
  href: string;
  negative?: boolean;
  size?: keyof typeof TILE_VALUE;
}) {
  return (
    <Link
      href={href}
      className="glass flex min-w-0 flex-col gap-1.5 rounded-3xl p-4 transition-colors hover:bg-(--glass-hover) sm:px-6 sm:py-5"
    >
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      <span className={cn("truncate font-semibold tracking-tight tabular-nums", TILE_VALUE[size], negative && "text-destructive")}>
        {value}
      </span>
      {note != null && <span className="text-xs text-muted-foreground">{note}</span>}
      {badge}
    </Link>
  );
}

const PILL = "inline-flex max-w-full items-center gap-0.5 self-start truncate rounded-full px-2 py-0.5 text-xs font-semibold";
const PILL_TONE = {
  good: "bg-good/12 text-good",
  bad: "bg-destructive/10 text-destructive",
  plain: "bg-foreground/5 text-muted-foreground",
} as const;

/**
 * "↑ 12% vs last month" in a pill: green when the change is good news, red when it is not,
 * grey when it is neither (`good` left out) or there is nothing to compare.
 */
export function Change({ now, before, good }: { now: number; before: number; good?: "up" | "down" }) {
  if (Math.abs(before) < 0.005) return <span className={cn(PILL, PILL_TONE.plain)}>Nothing to compare</span>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  const up = pct >= 0;
  const tone = good == null || pct === 0 ? "plain" : up === (good === "up") ? "good" : "bad";
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className={cn(PILL, PILL_TONE[tone])}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(pct)}% vs last month
    </span>
  );
}

export interface Row {
  /** Shown before the label, e.g. a part's photo. */
  icon?: ReactNode;
  label: ReactNode;
  note?: ReactNode;
  value?: ReactNode;
  href: string;
  strong?: boolean;
  negative?: boolean;
}

/** A glass card of tappable rows with the figure on the right, like an iPhone settings screen. */
export function Rows({ rows, header }: { rows: Row[]; header?: ReactNode }) {
  return (
    <div className="glass overflow-hidden rounded-3xl">
      {header}
      <ul className={cn("divide-y divide-foreground/[0.07]", header != null && "border-t border-foreground/[0.07]")}>
        {rows.map((row, i) => (
          <li key={i}>
            <Link
              href={row.href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.04] sm:px-6"
            >
              {row.icon}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The big figure at the top of a card. */
export function CardHead({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 pt-4 pb-3.5 sm:px-6 sm:pt-5 sm:pb-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</span>
      {note != null && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

/** One colour per age band, green (new) to red (oldest), in Apple's light and dark shades. */
const AGE_COLORS = [
  "bg-[#34c759] dark:bg-[#30d158]",
  "bg-[#ffcc00] dark:bg-[#ffd60a]",
  "bg-[#ff9500] dark:bg-[#ff9f0a]",
  "bg-[#ff3b30] dark:bg-[#ff453a]",
];

/** What customers owe, split by age: a coloured bar of the bands, then one line per band. */
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
  const shown = buckets.some((b) => b.value > 0);
  return (
    <Link href={href} className="glass flex flex-col gap-4 rounded-3xl pb-5 transition-colors hover:bg-(--glass-hover)">
      <div className="flex items-start justify-between pr-4 sm:pr-6">
        <CardHead
          label="Customers owe you"
          value={formatMoney(total)}
          note={`${customers} customer${customers === 1 ? "" : "s"}`}
        />
        <ChevronRightIcon className="mt-5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      </div>
      {shown && (
        <div className="mx-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full sm:mx-6" aria-hidden>
          {buckets.map((b, i) =>
            b.value > 0 ? (
              <span key={b.label} className={AGE_COLORS[i]} style={{ width: `${(b.value / total) * 100}%` }} />
            ) : null,
          )}
        </div>
      )}
      <ul className="mx-4 flex flex-col gap-2.5 sm:mx-6">
        {buckets.map((b, i) => (
          <li key={b.label} className="flex items-center gap-2.5">
            <span className={cn("size-2.5 shrink-0 rounded-full", AGE_COLORS[i])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{b.label} old</span>
            <span className="shrink-0 font-medium tabular-nums">{formatMoney(b.value)}</span>
          </li>
        ))}
      </ul>
    </Link>
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

/** Sales in blue, purchases in orange; they differ in lightness too, so they stay apart for everyone. */
const SERIES = [
  { key: "sales", label: "Sales", color: "bg-tint" },
  { key: "purchases", label: "Purchases", color: "bg-[#f0a35e] dark:bg-[#ff9f0a]" },
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
    <div className="glass flex flex-col gap-5 rounded-3xl p-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex gap-5 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-2">
              <span className={cn("size-2.5 rounded-[3px]", s.color)} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <Link href={href} className="text-sm font-medium text-tint hover:underline">
          Sales report
        </Link>
      </div>
      <div className="relative" aria-hidden>
        {max > 0 && (
          <span className="absolute -top-1 left-0 text-[11px] text-muted-foreground tabular-nums">{shortMoney(max)}</span>
        )}
        <div className="grid h-44 grid-cols-6 items-end gap-2 border-b border-foreground/10 pt-4 sm:h-52 sm:gap-4">
          {rows.map((r) => (
            <div key={r.month} className="group relative flex h-full items-end justify-center gap-1">
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className={cn("w-full max-w-6 rounded-t-md rounded-b-[2px]", s.color)}
                  style={{ height: height(r[s.key]) }}
                />
              ))}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 flex-col rounded-xl border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:flex">
                <span className="font-semibold">{monthName(r.month)}</span>
                <span className="tabular-nums">Sales {formatMoney(r.sales)}</span>
                <span className="tabular-nums">Purchases {formatMoney(r.purchases)}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-2 text-center text-xs text-muted-foreground sm:gap-4">
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
