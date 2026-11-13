import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RecurringForm } from "@/components/recurring/recurring-form";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInIndia } from "@/server/invoice-writes";
import { getRepeatSource } from "@/server/recurring";

export const metadata: Metadata = { title: "Repeat an invoice" };

async function Form({ searchParams }: { searchParams: PageProps<"/recurring/new">["searchParams"] }) {
  const raw = (await searchParams).invoice;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  const invoice = await getRepeatSource(id);
  if (!invoice) notFound();
  const back = (
    <Link href={`/invoices/${invoice.id}`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" /> Invoice {invoice.number}
    </Link>
  );
  if (invoice.status !== "final" || invoice.customerId == null) {
    return (
      <>
        {back}
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {invoice.status !== "final"
            ? "A cancelled invoice cannot be repeated."
            : "A walk-in invoice cannot be repeated. Save the customer first, then bill them."}
        </p>
      </>
    );
  }
  return (
    <>
      {back}
      <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        Repeats invoice <span className="font-mono">{invoice.number}</span> of {formatDate(invoice.date)} for{" "}
        <strong>{invoice.customerName}</strong>: the same items and rates, {formatMoney(invoice.grandTotal)}. You check
        each new invoice before it is saved.
      </p>
      <RecurringForm invoiceId={invoice.id} invoiceDate={invoice.date} today={todayInIndia()} />
    </>
  );
}

export default function NewRecurringPage({ searchParams }: PageProps<"/recurring/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Repeat an invoice</h1>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
