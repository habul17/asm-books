import { ArrowLeftIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { DocumentDetailsForm } from "@/components/documents/document-details-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/documents/documents";
import { formatDate } from "@/lib/format";
import { viewerIsOwner } from "@/server/auth";
import { getDocument } from "@/server/documents";

export const metadata: Metadata = { title: "Document" };

async function Document({ params }: { params: PageProps<"/documents/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [doc, owner] = await Promise.all([getDocument(id), viewerIsOwner()]);
  if (!doc) notFound();
  const file = `/documents/${doc.id}/file`;
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto min-w-0 truncate text-xl font-semibold">{doc.title}</h1>
        <a href={file} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ExternalLinkIcon /> Open
        </a>
        <a href={`${file}?download`} className={buttonVariants({ size: "sm" })}>
          <DownloadIcon /> Download
        </a>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          {isPdf ? "PDF" : "Photo"} · {formatBytes(doc.size)}
        </span>
        <span>
          Added {formatDate(doc.createdAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))}
          {doc.uploadedByName && ` by ${doc.uploadedByName}`}
        </span>
        {doc.billId != null && doc.billNo && (
          <span>
            Bill{" "}
            <Link href={`/bills/${doc.billId}`} className="font-mono font-medium text-foreground hover:underline">
              {doc.billNo}
            </Link>
          </span>
        )}
        {doc.expenseId != null && doc.expenseNumber && (
          <span>
            Expense{" "}
            <Link href={`/expenses/${doc.expenseId}`} className="font-mono font-medium text-foreground hover:underline">
              {doc.expenseNumber}
            </Link>
          </span>
        )}
      </p>

      {isPdf ? (
        <a
          href={file}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/60"
        >
          This is a PDF. Press here to open it.
        </a>
      ) : (
        <a href={file} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border bg-muted/30">
          {/* A private file served by this app; the image optimiser must not cache it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file} alt={doc.title} className="mx-auto max-h-[70vh] w-auto max-w-full" />
        </a>
      )}

      <DocumentDetailsForm doc={doc} canHide={owner} />

      {owner && <DeleteDocumentButton id={doc.id} />}
    </>
  );
}

export default function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/documents" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All documents
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Document params={params} />
      </Suspense>
    </div>
  );
}
