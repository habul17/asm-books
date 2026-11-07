import type { Metadata } from "next";
import { Suspense } from "react";

import { NewPaymentForm, PaymentFormSkeleton } from "@/components/payments/payment-loaders";

export const metadata: Metadata = { title: "Receive payment" };

async function Form({ searchParams }: { searchParams: PageProps<"/payments/new">["searchParams"] }) {
  const raw = (await searchParams).customer;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NewPaymentForm customerId={Number.isSafeInteger(n) && n > 0 ? n : null} />;
}

export default function NewPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Receive payment</h1>
      <Suspense fallback={<PaymentFormSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
