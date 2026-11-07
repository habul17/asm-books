import type { Metadata } from "next";
import { Suspense } from "react";

import { NewReturnForm, ReturnFormSkeleton } from "@/components/credit-notes/return-loader";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { InvoiceList, InvoiceListSkeleton } from "@/components/invoices/invoice-list";

export const metadata: Metadata = { title: "New return" };

type Params = Awaited<PageProps<"/credit-notes/new">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** With ?invoice=ID the return form; without it, a search to pick the invoice. */
async function Content({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const invoiceId = Number(first(params.invoice));
  if (Number.isSafeInteger(invoiceId) && invoiceId > 0) {
    return (
      <Suspense fallback={<ReturnFormSkeleton />}>
        <NewReturnForm invoiceId={invoiceId} />
      </Suspense>
    );
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">Which invoice are the parts from?</p>
      <ListToolbar path="/credit-notes/new" label="Search invoices" placeholder="Search invoice no, customer or mobile…" />
      <Suspense fallback={<InvoiceListSkeleton />}>
        <InvoiceList
          filters={{ query: first(params.q).slice(0, 200), status: "final", customerId: null }}
          pickForReturn
        />
      </Suspense>
    </>
  );
}

export default function NewCreditNotePage({ searchParams }: PageProps<"/credit-notes/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New return</h1>
      <Suspense fallback={<ReturnFormSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
