"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { applyRateListAction, scanRateListAction } from "@/app/(app)/catalogue/actions";
import { Field } from "@/components/forms/save-form";
import { ScanBox, ScanWarnings } from "@/components/forms/scan-box";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RateReview, RateRow, RateStatus } from "@/lib/catalogue/rate-list";
import { formatMoney } from "@/lib/format";

const SECTIONS: { status: RateStatus; title: string; help: string }[] = [
  { status: "changed", title: "Price changed", help: "A new purchase price is saved from the date below. Stock already bought keeps what it cost." },
  { status: "new", title: "New parts", help: "Parts not in your list yet. Tick only the ones you will buy or sell." },
  { status: "unclear", title: "Could not use", help: "Add or fix these by hand if you need them." },
  { status: "same", title: "Same price", help: "Nothing to change." },
];

const num = (s: string) => {
  const n = Number(s.replace(/[₹,\s]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};
const show = (n: number | null) => (n == null ? "" : String(Math.round(n * 100) / 100));

export function RateListReview({ scanReady, today }: { scanReady: boolean; today: string }) {
  const [review, setReview] = useState<RateReview | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState<Map<number, string>>(new Map());
  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const start = (r: RateReview) => {
    setReview(r);
    setMessage(null);
    setDate(r.date ?? today);
    setSupplier(r.supplierName ?? "");
    setPrices(new Map(r.rows.map((row) => [row.n, show(row.price)])));
    // Changed prices are ticked unless something needs a look; new parts are left for the owner to choose.
    setPicked(new Set(r.rows.filter((row) => row.status === "changed" && !row.note).map((row) => row.n)));
  };

  const groups = useMemo(() => {
    const g = new Map<RateStatus, RateRow[]>(SECTIONS.map((s) => [s.status, []]));
    for (const row of review?.rows ?? []) g.get(row.status)!.push(row);
    return g;
  }, [review]);

  const toggle = (n: number, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(n);
      else next.delete(n);
      return next;
    });
  const pickAll = (rows: RateRow[], on: boolean) => setPicked((p) => {
    const next = new Set(p);
    for (const r of rows) {
      if (on) next.add(r.n);
      else next.delete(r.n);
    }
    return next;
  });

  const chosen = review?.rows.filter((r) => picked.has(r.n) && (r.status === "changed" || r.status === "new")) ?? [];
  const bad = chosen.filter((r) => num(prices.get(r.n) ?? "") == null);

  const save = () => {
    if (!review || !chosen.length || bad.length) return;
    const priceOf = (r: RateRow) => num(prices.get(r.n) ?? "")!;
    const input = {
      date,
      supplier: supplier.trim() || null,
      updates: chosen.filter((r) => r.status === "changed" && r.part).map((r) => ({ productId: r.part!.id, price: priceOf(r) })),
      newParts: chosen
        .filter((r) => r.status === "new")
        .map((r) => ({ partNo: r.partNo!, description: r.description || r.partNo!, hsn: r.hsn, unit: r.unit, gstRate: r.gstRate, price: priceOf(r) })),
    };
    startSaving(async () => {
      const res = await applyRateListAction(input).catch(() => ({ error: "Could not save. Check your internet and try again." }));
      if ("error" in res) return setMessage({ ok: false, text: res.error });
      const parts = [`${res.updated} price${res.updated === 1 ? "" : "s"} updated`, `${res.added} new part${res.added === 1 ? "" : "s"} added`];
      if (res.skipped.length) parts.push(`${res.skipped.join(", ")} already in the list, skipped`);
      setMessage({ ok: true, text: `Saved: ${parts.join(", ")}.` });
      setReview(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ScanBox
        ready={scanReady}
        noun="rate list"
        help="Upload the supplier's rate list (PDF or photo). You see which prices changed and which parts are new before anything is saved."
        waitHelp="A long list can take 1 to 3 minutes. Please keep this screen open."
        action={scanRateListAction}
        onScan={start}
      />

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "" : "text-destructive"}`}>
          {message.text}{" "}
          {message.ok && (
            <Link href="/catalogue" className="underline underline-offset-4">
              Back to items
            </Link>
          )}
        </p>
      )}

      {review && (
        <>
          <ScanWarnings warnings={review.warnings} />
          <p className="text-sm text-muted-foreground">
            {review.rows.length} rows read · rates taken as {review.basis}; prices below are before GST.
          </p>

          {SECTIONS.map(({ status, title, help }) => {
            const rows = groups.get(status)!;
            if (!rows.length) return null;
            const choosable = status === "changed" || status === "new";
            const body = (
              <div className="divide-y">
                {rows.map((r) => (
                  <div key={r.n} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    {choosable && (
                      <input
                        type="checkbox"
                        aria-label={`Save row ${r.n} ${r.partNo ?? ""}`}
                        checked={picked.has(r.n)}
                        onChange={(e) => toggle(r.n, e.target.checked)}
                        className="size-4 accent-primary"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{r.part?.partNo ?? r.partNo ?? "—"}</span>{" "}
                      <span className="text-muted-foreground">{r.part?.description ?? r.description}</span>
                      {r.note && <p className="text-xs text-destructive">{r.note}</p>}
                    </div>
                    {status === "changed" && (
                      <span className="tabular-nums text-muted-foreground">
                        {r.part?.oldPrice != null ? formatMoney(r.part.oldPrice) : "no price"} →
                      </span>
                    )}
                    {choosable ? (
                      <Input
                        aria-label={`New price for ${r.part?.partNo ?? r.partNo ?? `row ${r.n}`}`}
                        inputMode="decimal"
                        value={prices.get(r.n) ?? ""}
                        onChange={(e) => setPrices((m) => new Map(m).set(r.n, e.target.value))}
                        className="h-8 w-28 text-right tabular-nums"
                      />
                    ) : (
                      <span className="tabular-nums">{r.price != null ? formatMoney(r.price) : ""}</span>
                    )}
                    {status === "changed" && r.changePct != null && (
                      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                        {r.changePct > 0 ? "+" : ""}
                        {r.changePct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
            return (
              <section key={status} aria-label={title} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">
                    {title} ({rows.length})
                  </h2>
                  {choosable && (
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="xs" onClick={() => pickAll(rows, true)}>
                        Tick all
                      </Button>
                      <Button type="button" variant="ghost" size="xs" onClick={() => pickAll(rows, false)}>
                        Untick all
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{help}</p>
                {status === "same" ? (
                  <details>
                    <summary className="cursor-pointer text-sm">Show</summary>
                    {body}
                  </details>
                ) : (
                  body
                )}
              </section>
            );
          })}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prices apply from" htmlFor="rl-date">
              <Input id="rl-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Supplier (optional)" htmlFor="rl-supplier">
              <Input id="rl-supplier" maxLength={200} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </Field>
          </div>
          {bad.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Type a price for {bad.map((r) => r.part?.partNo ?? r.partNo).join(", ")}, or untick it.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" disabled={saving || !chosen.length || bad.length > 0} onClick={save}>
              {saving ? "Saving…" : `Save ${chosen.length} ticked row${chosen.length === 1 ? "" : "s"}`}
            </Button>
            <Link href="/catalogue" className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
