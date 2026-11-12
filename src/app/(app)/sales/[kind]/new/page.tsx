import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditorSkeleton, NewSalesDocEditor } from "@/components/invoices/editor-loaders";
import { kindFromSlug, SALES_DOC_KIND } from "@/lib/sales-docs/kinds";

type Props = PageProps<"/sales/[kind]/new">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? `New ${SALES_DOC_KIND[kind].noun}` : "Not found" };
}

const positive = (raw: string | string[] | undefined) => {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

async function Editor({ params, searchParams }: Props) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const query = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">New {SALES_DOC_KIND[kind].noun}</h1>
      <NewSalesDocEditor kind={kind} customerId={positive(query.customer)} fromId={positive(query.from)} />
    </>
  );
}

export default function NewSalesDocPage(props: Props) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Suspense fallback={<EditorSkeleton />}>
        <Editor {...props} />
      </Suspense>
    </div>
  );
}
