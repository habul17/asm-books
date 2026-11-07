import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditInvoiceEditor, EditorSkeleton } from "@/components/invoices/editor-loaders";

export const metadata: Metadata = { title: "Edit invoice" };

async function Editor({ params }: { params: PageProps<"/invoices/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditInvoiceEditor id={id} />;
}

export default function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit invoice</h1>
      <Suspense fallback={<EditorSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}
