import type { Metadata } from "next";
import { Suspense } from "react";

import { BillEditorSkeleton, NewBillForm } from "@/components/bills/bill-loaders";

export const metadata: Metadata = { title: "New bill" };

/** Reading a scanned bill can take a while; give the request time to finish. */
export const maxDuration = 60;

async function Form({ searchParams }: { searchParams: PageProps<"/bills/new">["searchParams"] }) {
  const query = await searchParams;
  const id = (raw: string | string[] | undefined) => {
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  return <NewBillForm vendorId={id(query.vendor)} fromOrderId={id(query.from)} />;
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
