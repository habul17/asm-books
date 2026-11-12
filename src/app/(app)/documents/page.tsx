import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { DocumentList, DocumentListSkeleton } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_FOLDERS, formatBytes, isDocumentFolder } from "@/lib/documents/documents";
import { viewerIsOwner } from "@/server/auth";
import { documentStorage } from "@/server/documents";

export const metadata: Metadata = { title: "Documents" };

type Params = Awaited<PageProps<"/documents">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const folder = first(params.status);
  return <DocumentList filters={{ query: first(params.q).slice(0, 200), folder: isDocumentFolder(folder) ? folder : "all" }} />;
}

async function Upload() {
  await connection();
  const [canHide, storage] = await Promise.all([viewerIsOwner(), documentStorage()]);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <DocumentUpload options canHide={canHide} />
      <p className="text-xs text-muted-foreground">
        Photos (JPG, PNG) and PDF files, up to 4 MB each. Big photos are made smaller for you. Using{" "}
        {formatBytes(storage.used)} of {formatBytes(storage.limit)}.
      </p>
    </section>
  );
}

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Documents</h1>
      <Suspense fallback={<Skeleton className="h-24 rounded-xl" />}>
        <Upload />
      </Suspense>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/documents"
          label="Search documents"
          placeholder="Search name or notes…"
          filterLabel="Folder"
          statusLabels={{ all: "All folders", ...DOCUMENT_FOLDERS }}
        />
      </Suspense>
      <Suspense fallback={<DocumentListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
