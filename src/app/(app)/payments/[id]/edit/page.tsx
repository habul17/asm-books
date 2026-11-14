import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FreshOnShow } from "@/components/forms/fresh-on-show";
import { EditPaymentForm, PaymentFormSkeleton } from "@/components/payments/payment-loaders";

export const metadata: Metadata = { title: "Edit payment" };

async function Form({ params }: { params: PageProps<"/payments/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditPaymentForm id={id} />;
}

export default function EditPaymentPage({ params }: PageProps<"/payments/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit payment</h1>
      <FreshOnShow>
        <Suspense fallback={<PaymentFormSkeleton />}>
          <Form params={params} />
        </Suspense>
      </FreshOnShow>
    </div>
  );
}
