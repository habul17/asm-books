import type { Metadata } from "next";
import { Suspense } from "react";

import { NewVendorPaymentForm, VendorPaymentFormSkeleton } from "@/components/payments-made/vendor-payment-loaders";

export const metadata: Metadata = { title: "Pay a vendor" };

async function Form({ searchParams }: { searchParams: PageProps<"/payments-made/new">["searchParams"] }) {
  const raw = (await searchParams).vendor;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NewVendorPaymentForm vendorId={Number.isSafeInteger(n) && n > 0 ? n : null} />;
}

export default function NewVendorPaymentPage({ searchParams }: PageProps<"/payments-made/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Pay a vendor</h1>
      <Suspense fallback={<VendorPaymentFormSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
