"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatPct, type PriceChange, type PriceSummary } from "@/lib/bills/price-check";
import { formatDate, formatMoney } from "@/lib/format";

/** One bill row with how its rate compares with the last bill. */
export interface PricedLine {
  key: string;
  description: string;
  partNo: string | null;
  /** Rate after discount, before GST. */
  net: number | null;
  change: PriceChange | null;
}

const UP = "text-destructive";
const DOWN = "text-emerald-700 dark:text-emerald-400";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The note under a bill row: same as the last bill, or how much more or less. */
export function PriceHint({ change }: { change: PriceChange | null }) {
  if (!change) return null;
  if (change.kind === "first") return <p className="text-xs text-muted-foreground">First time on a bill</p>;
  if (change.kind === "same") return <p className="text-xs text-muted-foreground">Same as last bill</p>;
  const up = change.kind === "up";
  return (
    <p className={cn("flex items-center gap-1 text-xs font-medium", up ? UP : DOWN)}>
      {up ? <ArrowUpIcon className="size-3.5 shrink-0" aria-hidden /> : <ArrowDownIcon className="size-3.5 shrink-0" aria-hidden />}
      <span>
        {formatMoney(change.diff)} {up ? "more" : "less"} than last bill ({formatMoney(change.last.net)})
      </span>
    </p>
  );
}

/** The counts above the rows; tapping it opens the price check. */
export function PriceCheckBar({ summary, onOpen }: { summary: PriceSummary; onOpen: () => void }) {
  if (summary.up + summary.down + summary.same === 0) return null;
  const parts: ReactNode[] = [];
  if (summary.up) parts.push(<span key="up" className={cn("font-medium", UP)}>{summary.up} up</span>);
  if (summary.down) parts.push(<span key="down" className={cn("font-medium", DOWN)}>{summary.down} down</span>);
  if (summary.same) parts.push(<span key="same">{summary.same} same</span>);
  if (summary.first) parts.push(<span key="first">{summary.first} first time</span>);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="font-medium">Price check</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-x-2 text-muted-foreground">
        {parts.map((p, i) => (
          <span key={i} className="flex gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {p}
          </span>
        ))}
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function ChangedRow({ line, vendorName }: { line: PricedLine; vendorName: string | null }) {
  const c = line.change;
  if (!c || (c.kind !== "up" && c.kind !== "down")) return null;
  const up = c.kind === "up";
  const where = [
    line.partNo,
    `last bill ${c.last.billNo}`,
    formatDate(c.last.date),
    c.last.vendor !== vendorName ? c.last.vendor : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{line.description}</p>
        <p className={cn("flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums", up ? UP : DOWN)}>
          {up ? <ArrowUpIcon className="size-3.5" aria-hidden /> : <ArrowDownIcon className="size-3.5" aria-hidden />}
          {formatMoney(c.diff)}
          {c.pct != null && <span className="whitespace-pre"> · {formatPct(c.pct)}</span>}
        </p>
      </div>
      <p className="text-sm tabular-nums">
        <span className="text-muted-foreground">{formatMoney(c.last.net)} → </span>
        <span className="font-medium">{formatMoney(line.net)}</span>
      </p>
      <p className="text-xs text-muted-foreground">{where}</p>
    </li>
  );
}

function PlainRow({ line }: { line: PricedLine }) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{line.description}</span>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatMoney(line.net)}</span>
    </li>
  );
}

function Group({ title, tone, open, children }: { title: string; tone?: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-sm font-semibold outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        <span className={tone}>{title}</span>
      </summary>
      <ul className="divide-y pl-5.5">{children}</ul>
    </details>
  );
}

/**
 * The popup after a bill is scanned: each part's rate against the last bill it was on,
 * with what went up or down first.
 */
export function PriceCheckDialog({
  open,
  onOpenChange,
  lines,
  vendorName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: PricedLine[];
  /** This bill's vendor, so another vendor's last bill is named. */
  vendorName: string | null;
}) {
  const of = (kind: PriceChange["kind"]) => lines.filter((l) => l.change?.kind === kind);
  const up = of("up").sort((a, b) => pctOf(b) - pctOf(a));
  const down = of("down").sort((a, b) => pctOf(b) - pctOf(a));
  const same = of("same");
  const first = of("first");
  const changed = up.length + down.length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-center gap-2">
            <Dialog.Title className="min-w-0 flex-1 truncate text-base font-semibold">Price check</Dialog.Title>
            <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close">
              <XIcon />
            </Dialog.Close>
          </div>
          <Dialog.Description className="-mt-2 text-sm text-muted-foreground">
            {changed === 0 && same.length > 0
              ? `All ${plural(same.length, "part")} cost the same as on the last bill.`
              : `${plural(changed, "part")} changed price since the last bill.`}{" "}
            Rates after discount, before GST.
          </Dialog.Description>

          {changed === 0 && same.length > 0 && (
            <p className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium">
              <CheckIcon className="size-4 shrink-0" aria-hidden /> No price changes
            </p>
          )}

          <div className="flex flex-col gap-1">
            {up.length > 0 && (
              <Group title={`Costlier (${up.length})`} tone={UP} open>
                {up.map((l) => (
                  <ChangedRow key={l.key} line={l} vendorName={vendorName} />
                ))}
              </Group>
            )}
            {down.length > 0 && (
              <Group title={`Cheaper (${down.length})`} tone={DOWN} open>
                {down.map((l) => (
                  <ChangedRow key={l.key} line={l} vendorName={vendorName} />
                ))}
              </Group>
            )}
            {same.length > 0 && (
              <Group title={`Same price (${same.length})`}>
                {same.map((l) => (
                  <PlainRow key={l.key} line={l} />
                ))}
              </Group>
            )}
            {first.length > 0 && (
              <Group title={`First time on a bill (${first.length})`}>
                {first.map((l) => (
                  <PlainRow key={l.key} line={l} />
                ))}
              </Group>
            )}
          </div>

          <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const pctOf = (l: PricedLine) => (l.change && "pct" in l.change && l.change.pct != null ? l.change.pct : 0);
