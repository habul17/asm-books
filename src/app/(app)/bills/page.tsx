import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BillList, BillListSkeleton } from "@/components/bills/bill-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import type { BillStatusFilter } from "@/server/bills";

export const metadata: Metadata = { title: "Bills" };

type Params = Awaited<PageProps<"/bills">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <BillList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as BillStatusFilter,
        vendorId: null,
      }}
    />
  );
}

export default function BillsPage({ searchParams }: PageProps<"/bills">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bills</h1>
        <Link href="/bills/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New bill
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/bills"
          label="Search bills"
          placeholder="Search bill no, vendor or mobile…"
          statusLabels={{ all: "All bills", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<BillListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
