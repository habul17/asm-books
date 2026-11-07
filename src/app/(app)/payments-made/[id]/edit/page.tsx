import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditVendorPaymentForm, VendorPaymentFormSkeleton } from "@/components/payments-made/vendor-payment-loaders";

export const metadata: Metadata = { title: "Edit payment made" };

async function Form({ params }: { params: PageProps<"/payments-made/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditVendorPaymentForm id={id} />;
}

export default function EditVendorPaymentPage({ params }: PageProps<"/payments-made/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit payment made</h1>
      <Suspense fallback={<VendorPaymentFormSkeleton />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
