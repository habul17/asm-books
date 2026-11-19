import { PackageIcon } from "lucide-react";

import { formatDate, formatMoney, formatQty } from "@/lib/format";
import type { InvoiceDetail } from "@/server/invoices";

/**
 * Owner only, never printed: which purchase bill each sold piece came from
 * (first in, first out), what those pieces really cost, and the profit on each row.
 */
export function InvoiceBatches({ inv }: { inv: InvoiceDetail }) {
  if (!inv.batches?.length) return null;
  const byLine = Map.groupBy(inv.batches, (b) => b.lineNo);
  const label = inv.nonGst ? "Markup price" : "Price list rate";
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4 print:hidden">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <PackageIcon className="size-4" /> Where the pieces came from
        <span className="font-normal text-muted-foreground">· only you see this, it is not printed</span>
      </h2>
      <ul className="flex flex-col divide-y">
        {inv.lines.map((l) => {
          const rows = byLine.get(l.lineNo);
          if (!rows?.length) return null;
          const known = rows.every((r) => r.cost != null);
          const cost = rows.reduce((s, r) => s + r.qty * (r.cost ?? 0), 0);
          return (
            <li key={l.lineNo} className="flex flex-col gap-1 py-2 text-sm">
              <p className="font-medium">
                {l.lineNo}. {l.partNo && <span className="font-mono">{l.partNo} </span>}
                {l.description} · {formatQty(l.qty)} {l.unit}
              </p>
              <ul className="flex flex-col gap-0.5 pl-4 text-muted-foreground">
                {rows.map((r, i) => (
                  <li key={i}>
                    {formatQty(r.qty)} {l.unit}{" "}
                    {r.short
                      ? "sold with no stock left"
                      : r.billNo
                        ? `from bill ${r.billNo}${r.billDate ? ` (${formatDate(r.billDate)})` : ""}`
                        : "from older stock (no bill)"}
                    {r.cost != null && ` · bought at ${formatMoney(r.cost)} each`}
                  </li>
                ))}
              </ul>
              {l.listRate != null && <RateNote listRate={l.listRate} rate={l.rate} qty={l.qty} label={label} />}
              {known && (
                <p className="pl-4">
                  Cost {formatMoney(cost)} · sold for {formatMoney(l.taxable)} ·{" "}
                  <span className="font-medium">profit {formatMoney(l.taxable - cost)}</span>{" "}
                  <span className="text-muted-foreground">(before GST)</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The rate the price list or markup gave, and how much was added to it (or taken off) by hand. */
function RateNote({ listRate, rate, qty, label }: { listRate: number; rate: number; qty: number; label: string }) {
  const diff = Math.round((rate - listRate) * 100) / 100;
  return (
    <p className="pl-4">
      {label} {formatMoney(listRate)} · sold at {formatMoney(rate)}
      {diff === 0 ? (
        <span className="text-muted-foreground"> · no change</span>
      ) : (
        <>
          {" · "}
          <span className="font-medium">
            {formatMoney(Math.abs(diff))} {diff > 0 ? "added" : "less"} per piece
          </span>{" "}
          <span className="text-muted-foreground">({formatMoney(Math.abs(diff * qty))} in all)</span>
        </>
      )}
    </p>
  );
}
