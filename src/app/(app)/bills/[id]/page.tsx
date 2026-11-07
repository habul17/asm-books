import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CancelBillForm } from "@/components/bills/cancel-bill-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorBalance } from "@/components/vendors/vendor-balance";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { getBill } from "@/server/bills";

export const metadata: Metadata = { title: "Bill" };

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 text-base font-semibold" : "flex justify-between"}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

async function Bill({ params }: { params: PageProps<"/bills/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const b = await getBill(id);
  if (!b) notFound();
  const final = b.status === "final";
  const inter = b.taxType === "inter";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          Bill <span className="font-mono">{b.billNo}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        {final && (
          <Link href={`/bills/${b.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        <Link href={`/bills/new?vendor=${b.vendorId}`} className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another bill
        </Link>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Vendor</span>
          <Link href={`/vendors/${b.vendorId}`} className="font-medium hover:underline">
            {b.vendorName}
          </Link>
          <span className="text-xs text-muted-foreground">
            {[b.vendorCity, b.vendorMobile, b.vendorGstin].filter(Boolean).join(" · ")}
          </span>
          <span className="text-sm">
            Now: <VendorBalance amount={b.balanceNow} />
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-muted-foreground">Bill date</dt>
          <dd>{formatDate(b.date)}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{b.dueDate ? formatDate(b.dueDate) : "—"}</dd>
          <dt className="text-muted-foreground">Tax</dt>
          <dd>{inter ? "IGST (other state)" : "CGST + SGST"}</dd>
          <dt className="text-muted-foreground">Prices</dt>
          <dd>{b.updatePrices ? "Purchase prices updated" : "Purchase prices not changed"}</dd>
          {b.createdByName && (
            <>
              <dt className="text-muted-foreground">Entered by</dt>
              <dd>{b.createdByName}</dd>
            </>
          )}
          {!final && b.cancelReason && (
            <>
              <dt className="text-muted-foreground">Cancelled</dt>
              <dd>{b.cancelReason}</dd>
            </>
          )}
        </dl>
      </div>

      <ul className="flex flex-col divide-y rounded-xl border">
        {b.lines.map((l) => (
          <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3">
            <span className="truncate font-medium">{l.description}</span>
            <span className="text-right font-medium tabular-nums">{formatMoney(l.total)}</span>
            <span className="truncate text-xs text-muted-foreground">
              {l.partNo && <span className="font-mono">{l.partNo} · </span>}
              {formatQty(l.qty)} {l.unit} × ₹{l.rate}
              {l.discountPct > 0 && <> − {l.discountPct}%</>} · GST {l.gstRate}%
            </span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{formatMoney(l.taxable)}</span>
          </li>
        ))}
      </ul>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        <Row label="Taxable value" value={b.taxableTotal} />
        {inter ? (
          <Row label="IGST" value={b.igstTotal} />
        ) : (
          <>
            <Row label="CGST" value={b.cgstTotal} />
            <Row label="SGST" value={b.sgstTotal} />
          </>
        )}
        {b.roundOff !== 0 && <Row label="Round off" value={b.roundOff} />}
        <Row label="Total" value={b.grandTotal} strong />
      </dl>

      {b.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">Note: {b.notes}</p>}

      {final && <CancelBillForm id={b.id} />}
    </>
  );
}

export default function BillPage({ params }: PageProps<"/bills/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/bills" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All bills
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Bill params={params} />
      </Suspense>
    </div>
  );
}
