import type { Metadata } from "next";
import { Suspense } from "react";

import { EditorSkeleton, NewInvoiceEditor } from "@/components/invoices/editor-loaders";

export const metadata: Metadata = { title: "New invoice" };

async function Editor({ searchParams }: { searchParams: PageProps<"/invoices/new">["searchParams"] }) {
  const query = await searchParams;
  const positive = (raw: string | string[] | undefined) => {
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  // `from` starts the invoice from a quote, sales order or delivery challan.
  return <NewInvoiceEditor customerId={positive(query.customer)} fromDocId={positive(query.from)} />;
}

export default function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New invoice</h1>
      <Suspense fallback={<EditorSkeleton />}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
