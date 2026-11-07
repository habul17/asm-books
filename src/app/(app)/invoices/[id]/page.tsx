import { ArrowLeftIcon, CopyPlusIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CancelInvoiceForm, PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { getInvoice } from "@/server/invoices";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Invoice" };

async function Invoice({ params }: { params: PageProps<"/invoices/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [inv, business] = await Promise.all([getInvoice(id), getBusiness()]);
  if (!inv) notFound();
  const final = inv.status === "final";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{inv.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <PrintButton />
        {final && (
          <Link href={`/invoices/${inv.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        <Link
          href={inv.customerId ? `/invoices/new?customer=${inv.customerId}` : "/invoices/new"}
          className={buttonVariants({ size: "sm" })}
        >
          <CopyPlusIcon /> New invoice
        </Link>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        {inv.priceListName && <span>Price list: {inv.priceListName}</span>}
        {inv.createdByName && <span>Made by {inv.createdByName}</span>}
        {inv.profit != null && final && (
          <span>
            Profit: <span className="font-medium text-foreground">{formatMoney(inv.profit)}</span> (before tax; only
            you see this)
          </span>
        )}
        {!final && inv.cancelReason && <span>Cancelled: {inv.cancelReason}</span>}
      </p>

      <InvoiceDocument invoice={inv} business={business} />

      {final && <CancelInvoiceForm id={inv.id} />}
    </>
  );
}

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/invoices"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All invoices
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <Invoice params={params} />
      </Suspense>
    </div>
  );
}
