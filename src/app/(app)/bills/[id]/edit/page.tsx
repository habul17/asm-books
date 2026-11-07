import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BillEditorSkeleton, EditBillForm } from "@/components/bills/bill-loaders";

export const metadata: Metadata = { title: "Edit bill" };

async function Form({ params }: { params: PageProps<"/bills/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditBillForm id={id} />;
}

export default function EditBillPage({ params }: PageProps<"/bills/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit bill</h1>
      <Suspense fallback={<BillEditorSkeleton />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
