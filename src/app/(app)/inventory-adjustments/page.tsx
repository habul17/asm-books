import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdjustmentList, AdjustmentListSkeleton } from "@/components/adjustments/adjustment-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import type { AdjustmentStatusFilter } from "@/server/adjustments";

export const metadata: Metadata = { title: "Inventory adjustments" };

type Params = Awaited<PageProps<"/inventory-adjustments">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <AdjustmentList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as AdjustmentStatusFilter,
      }}
    />
  );
}

export default function AdjustmentsPage({ searchParams }: PageProps<"/inventory-adjustments">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Inventory adjustments</h1>
        <Link href="/inventory-adjustments/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New adjustment
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/inventory-adjustments"
          label="Search adjustments"
          placeholder="Search reason, number, part no or name…"
          statusLabels={{ all: "All adjustments", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<AdjustmentListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
