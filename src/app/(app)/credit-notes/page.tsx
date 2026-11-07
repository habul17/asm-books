import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CreditNoteList, CreditNoteListSkeleton } from "@/components/credit-notes/credit-note-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import type { CreditNoteStatusFilter } from "@/server/credit-notes";

export const metadata: Metadata = { title: "Credit notes" };

type Params = Awaited<PageProps<"/credit-notes">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <CreditNoteList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as CreditNoteStatusFilter,
        customerId: null,
      }}
    />
  );
}

export default function CreditNotesPage({ searchParams }: PageProps<"/credit-notes">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Credit notes</h1>
        <Link href="/credit-notes/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New return
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/credit-notes"
          label="Search credit notes"
          placeholder="Search credit note no, invoice no, customer or mobile…"
          statusLabels={{ all: "All credit notes", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<CreditNoteListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
