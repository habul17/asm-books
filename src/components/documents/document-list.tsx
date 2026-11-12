import { FileTextIcon, ImageIcon, LockIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_FOLDERS, formatBytes, isDocumentFolder } from "@/lib/documents/documents";
import { formatDate } from "@/lib/format";
import { searchDocuments, type DocumentFilters, type DocumentListItem } from "@/server/documents";

const folderName = (key: string) => (isDocumentFolder(key) ? DOCUMENT_FOLDERS[key] : "Other");
/** The day a document was added, as a date in India. */
const addedOn = (at: Date) => at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function DocumentRows({ items }: { items: DocumentListItem[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {items.map((d) => {
        const Icon = d.mimeType === "application/pdf" ? FileTextIcon : ImageIcon;
        return (
          <li key={d.id}>
            <Link
              href={`/documents/${d.id}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60"
            >
              <Icon className="row-span-2 size-5 text-muted-foreground" aria-hidden />
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate">{d.title}</span>
                {d.ownerOnly && <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Owner only" />}
              </span>
              <span className="text-right text-xs text-muted-foreground tabular-nums">{formatBytes(d.size)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {folderName(d.folder)} · {formatDate(d.docDate ?? addedOn(d.createdAt))}
                {d.billNo && <> · bill {d.billNo}</>}
                {d.expenseNumber && <> · expense {d.expenseNumber}</>}
              </span>
              <span className="text-right text-xs text-muted-foreground">{d.uploadedByName}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export async function DocumentList({ filters }: { filters: DocumentFilters }) {
  const { count, items } = await searchDocuments(filters);
  return (
    <section aria-label="Documents" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} document${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query || filters.folder !== "all"
            ? "No documents match."
            : "No documents yet. Upload a photo or PDF of a bill, a receipt or any shop paper."}
        </p>
      ) : (
        <DocumentRows items={items} />
      )}
    </section>
  );
}

export function DocumentListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
