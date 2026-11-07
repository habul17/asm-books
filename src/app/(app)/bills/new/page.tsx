import type { Metadata } from "next";
import { Suspense } from "react";

import { BillEditorSkeleton, NewBillForm } from "@/components/bills/bill-loaders";

export const metadata: Metadata = { title: "New bill" };

async function Form({ searchParams }: { searchParams: PageProps<"/bills/new">["searchParams"] }) {
  const raw = (await searchParams).vendor;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return <NewBillForm vendorId={Number.isSafeInteger(n) && n > 0 ? n : null} />;
}

export default function NewBillPage({ searchParams }: PageProps<"/bills/new">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New bill</h1>
      <Suspense fallback={<BillEditorSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
