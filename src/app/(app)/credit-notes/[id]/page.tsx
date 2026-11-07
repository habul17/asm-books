import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Balance } from "@/components/customers/balance";
import { CancelCreditNoteForm } from "@/components/credit-notes/cancel-credit-note-form";
import { PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { formatDate } from "@/lib/format";
import { getCreditNote } from "@/server/credit-notes";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Credit note" };

async function CreditNote({ params }: { params: PageProps<"/credit-notes/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [note, business] = await Promise.all([getCreditNote(id), getBusiness()]);
  if (!note) notFound();
  const final = note.status === "final";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{note.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <PrintButton />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        <span>
          Against invoice{" "}
          <Link href={`/invoices/${note.invoiceId}`} className="font-mono font-medium text-foreground hover:underline">
            {note.invoiceNumber}
          </Link>
        </span>
        <span>{note.refundType === "cash" ? "Cash refund" : "Credited to account"}</span>
        <span>{note.restocked ? "Parts put back in stock" : "Not put back in stock"}</span>
        {note.customerId != null && note.balanceNow != null && (
          <span>
            <Link href={customersHref({ id: note.customerId })} className="font-medium text-foreground hover:underline">
              {note.customerName}
            </Link>{" "}
            now: <Balance amount={note.balanceNow} />
          </span>
        )}
        {note.createdByName && <span>Made by {note.createdByName}</span>}
        {!final && note.cancelReason && <span>Cancelled: {note.cancelReason}</span>}
      </p>

      <InvoiceDocument
        invoice={note}
        business={business}
        title="Credit Note"
        details={
          <>
            <p>
              Against invoice {note.invoiceNumber} of {formatDate(note.invoiceDate)}
            </p>
            <p>Reason: {note.reason}</p>
          </>
        }
      />

      {final && <CancelCreditNoteForm id={note.id} />}
    </>
  );
}

export default function CreditNotePage({ params }: PageProps<"/credit-notes/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/credit-notes"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All credit notes
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <CreditNote params={params} />
      </Suspense>
    </div>
  );
}
