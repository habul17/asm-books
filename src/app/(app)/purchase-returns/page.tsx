import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { PurchaseReturnList, PurchaseReturnListSkeleton } from "@/components/purchase-returns/purchase-return-list";
import { buttonVariants } from "@/components/ui/button";
import type { PurchaseReturnStatusFilter } from "@/server/purchase-returns";

export const metadata: Metadata = { title: "Purchase returns" };

type Params = Awaited<PageProps<"/purchase-returns">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <PurchaseReturnList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as PurchaseReturnStatusFilter,
        vendorId: null,
      }}
    />
  );
}

export default function PurchaseReturnsPage({ searchParams }: PageProps<"/purchase-returns">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Purchase returns</h1>
          <p className="text-sm text-muted-foreground">Damaged or wrong parts sent back to a vendor.</p>
        </div>
        <Link href="/purchase-returns/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New return
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/purchase-returns"
          label="Search purchase returns"
          placeholder="Search debit note no, vendor or bill no…"
          statusLabels={{ all: "All returns", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<PurchaseReturnListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
