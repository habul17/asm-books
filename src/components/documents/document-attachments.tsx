import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import type { DocumentFolder } from "@/lib/documents/documents";
import { searchDocuments } from "@/server/documents";

import { DocumentRows } from "./document-list";
import { DocumentUpload } from "./document-upload";

type Link = { billId: number } | { expenseId: number };

async function Attached({ link }: { link: Link }) {
  const { items } = await searchDocuments({ query: "", folder: "all", ...link }, 50);
  return items.length > 0 ? <DocumentRows items={items} /> : null;
}

/** The scanned papers attached to a bill or an expense, with a button to add more. */
export function DocumentAttachments({ link, folder, hint }: { link: Link; folder: DocumentFolder; hint: string }) {
  return (
    <section aria-label="Attached files" className="flex flex-col gap-2 print:hidden">
      <h2 className="font-medium">
        Attached files <InfoTip label="About attached files">{hint}</InfoTip>
      </h2>
      <Suspense fallback={<Skeleton className="h-14 rounded-xl" />}>
        <Attached link={link} />
      </Suspense>
      <DocumentUpload link={link} folder={folder} label="Attach a photo or PDF" />
    </section>
  );
}
