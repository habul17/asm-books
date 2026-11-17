import { ArrowLeftIcon, CopyPlusIcon, HandCoinsIcon, PencilIcon, RepeatIcon, Undo2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CreditNoteList } from "@/components/credit-notes/credit-note-list";
import { deleteInvoiceAction } from "@/app/(app)/invoices/actions";
import { DeleteButton } from "@/components/forms/delete-button";
import { CancelInvoiceForm, PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceBatches } from "@/components/invoices/invoice-batches";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { PayBadge } from "@/components/invoices/pay-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TransportForm } from "@/components/transport/transport-form";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { needsEwayBill, transportRows } from "@/lib/transport";
import { getInvoice } from "@/server/invoices";
import { getBusiness } from "@/server/settings";
import { OwnerOnlyBlock } from "@/components/layout/owner-gate";

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
          {inv.nonGst && <Badge variant="outline">Non-GST</Badge>}
          {!final && <Badge variant="destructive">{inv.deletedAt ? "deleted" : "cancelled"}</Badge>}
          {inv.pay && <PayBadge pay={inv.pay} />}
        </h1>
        {inv.pay && inv.pay.status !== "paid" && (
          <Link href={`/payments/new?customer=${inv.customerId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <HandCoinsIcon /> Receive payment
          </Link>
        )}
        <PrintButton />
        {final && inv.canChange && (
          <Link href={`/invoices/${inv.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        {final && (
          <Link href={`/credit-notes/new?invoice=${inv.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Undo2Icon /> Return items
          </Link>
        )}
        {final && inv.customerId != null && (
          <Link href={`/recurring/new?invoice=${inv.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <RepeatIcon /> Repeat
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
        {inv.pay && (
          <span>
            Paid {formatMoney(inv.pay.paid)} · still to come{" "}
            <span className="font-medium text-foreground">{formatMoney(inv.pay.due)}</span>
            {inv.dueDate && inv.pay.status !== "paid" && <> · due {formatDate(inv.dueDate)}</>}
          </span>
        )}
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

      <InvoiceDocument
        invoice={inv}
        business={business}
        payQr
        nonGst={inv.nonGst}
        extra={inv.shownExtra}
        paymentTerms={inv.paymentType === "cash" ? PAYMENT_MODE_LABELS[inv.cashMode ?? "cash"] : "Credit"}
        user={inv.createdByName}
        createdAt={inv.createdAt}
        details={[
          ...(inv.dueDate ? [{ label: "Due Date", value: formatDate(inv.dueDate) }] : []),
          ...transportRows(inv.transport),
        ]}
      />

      {final && <InvoiceBatches inv={inv} />}

      {final && (
        <TransportForm
          target="invoice"
          id={inv.id}
          transport={inv.transport}
          needsEwayBill={needsEwayBill(inv.grandTotal, inv.transport)}
        />
      )}

      <div className="print:hidden">
        <CreditNoteList
          filters={{ query: "", status: "all", customerId: null, invoiceId: inv.id }}
          limit={50}
          compact
          title="Returns from this invoice"
        />
      </div>

      {inv.deletedAt ? (
        <p className="text-sm text-muted-foreground print:hidden">
          This invoice was deleted. It is hidden from lists and reports; its number is kept as cancelled for GST.
        </p>
      ) : (
        <OwnerOnlyBlock>
          <div className="flex flex-col gap-3 print:hidden">
            {final && <CancelInvoiceForm id={inv.id} />}
            <DeleteButton
              noun="invoice"
              action={deleteInvoiceAction.bind(null, inv.id)}
              note="Stock comes back. Only the newest invoice is removed completely; an older one keeps its number as cancelled for GST."
            />
          </div>
        </OwnerOnlyBlock>
      )}
    </>
  );
}

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none print:gap-0">
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
