import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cn } from "cn";

import { CancelAdjustmentForm } from "@/components/adjustments/cancel-adjustment-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { getAdjustment } from "@/server/adjustments";
import { OwnerOnlyBlock } from "@/components/layout/owner-gate";

export const metadata: Metadata = { title: "Inventory adjustment" };

const signed = (n: number) => `${n > 0 ? "+" : "−"}${formatQty(Math.abs(n))}`;

async function Adjustment({ params }: { params: PageProps<"/inventory-adjustments/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const adj = await getAdjustment(id);
  if (!adj) notFound();
  const final = adj.status === "final";
  const value = (sign: 1 | -1) =>
    adj.lines.reduce((s, l) => s + (Math.sign(l.qty) === sign && l.cost != null ? Math.abs(l.qty) * l.cost : 0), 0);
  const valueIn = value(1);
  const valueOut = value(-1);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{adj.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <Link href="/inventory-adjustments/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another adjustment
        </Link>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm">
        <dt className="text-muted-foreground">Reason</dt>
        <dd className="font-medium">{adj.reason}</dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd>{formatDate(adj.date)}</dd>
        {adj.createdByName && (
          <>
            <dt className="text-muted-foreground">Entered by</dt>
            <dd>{adj.createdByName}</dd>
          </>
        )}
        {adj.notes && (
          <>
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-line">{adj.notes}</dd>
          </>
        )}
        {!final && adj.cancelReason && (
          <>
            <dt className="text-muted-foreground">Cancelled</dt>
            <dd>{adj.cancelReason}</dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {adj.lines.length} item{adj.lines.length === 1 ? "" : "s"}
        </h2>
        <ul className="flex flex-col divide-y rounded-xl border">
          {adj.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3">
              <span className="truncate font-medium">{l.description}</span>
              <span className={cn("text-right font-medium tabular-nums", l.qty < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
                {signed(l.qty)} {l.unit}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {l.partNo && <span className="font-mono">{l.partNo} · </span>}
                {formatQty(l.qtyBefore)} → {formatQty(Math.round((l.qtyBefore + l.qty) * 1000) / 1000)} · stock now{" "}
                {formatQty(l.stockNow)}
              </span>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {l.cost != null ? formatMoney(Math.abs(l.qty) * l.cost) : "no cost"}
              </span>
            </li>
          ))}
        </ul>
        {(valueIn > 0 || valueOut > 0) && (
          <p className="text-right text-sm text-muted-foreground tabular-nums">
            At purchase price: {valueIn > 0 && <>added {formatMoney(valueIn)}</>}
            {valueIn > 0 && valueOut > 0 && " · "}
            {valueOut > 0 && <>taken out {formatMoney(valueOut)}</>}
          </p>
        )}
      </section>

      {final && (
        <OwnerOnlyBlock>
          <CancelAdjustmentForm id={adj.id} />
        </OwnerOnlyBlock>
      )}
    </>
  );
}

export default function AdjustmentPage({ params }: PageProps<"/inventory-adjustments/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        href="/inventory-adjustments"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> All adjustments
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Adjustment params={params} />
      </Suspense>
    </div>
  );
}
