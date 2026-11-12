import type { Metadata } from "next";
import { Suspense } from "react";

import { BillEditorSkeleton, NewPurchaseOrderForm } from "@/components/bills/bill-loaders";

export const metadata: Metadata = { title: "New purchase order" };

async function Form({ searchParams }: { searchParams: PageProps<"/purchase-orders/new">["searchParams"] }) {
  const raw = (await searchParams).vendor;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NewPurchaseOrderForm vendorId={Number.isSafeInteger(n) && n > 0 ? n : null} />;
}

export default function NewPurchaseOrderPage({ searchParams }: PageProps<"/purchase-orders/new">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New purchase order</h1>
      <Suspense fallback={<BillEditorSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
