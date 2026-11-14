import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FreshOnShow } from "@/components/forms/fresh-on-show";
import { EditorSkeleton, EditSalesDocEditor } from "@/components/invoices/editor-loaders";
import { kindFromSlug, SALES_DOC_KIND } from "@/lib/sales-docs/kinds";

type Props = PageProps<"/sales/[kind]/[id]/edit">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? `Edit ${SALES_DOC_KIND[kind].noun}` : "Not found" };
}

async function Editor({ params }: Props) {
  const { kind: slug, id: rawId } = await params;
  const kind = kindFromSlug(slug);
  const id = Number(rawId);
  if (!kind || !Number.isSafeInteger(id) || id <= 0) notFound();
  return (
    <>
      <h1 className="text-xl font-semibold">Edit {SALES_DOC_KIND[kind].noun}</h1>
      <EditSalesDocEditor kind={kind} id={id} />
    </>
  );
}

export default function EditSalesDocPage(props: Props) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <FreshOnShow>
        <Suspense fallback={<EditorSkeleton />}>
          <Editor {...props} />
        </Suspense>
      </FreshOnShow>
    </div>
  );
}
