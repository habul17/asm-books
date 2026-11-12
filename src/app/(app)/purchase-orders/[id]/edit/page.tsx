import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BillEditorSkeleton, EditPurchaseOrderForm } from "@/components/bills/bill-loaders";

export const metadata: Metadata = { title: "Edit purchase order" };

async function Form({ params }: { params: PageProps<"/purchase-orders/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditPurchaseOrderForm id={id} />;
}

export default function EditPurchaseOrderPage({ params }: PageProps<"/purchase-orders/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit purchase order</h1>
      <Suspense fallback={<BillEditorSkeleton />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
