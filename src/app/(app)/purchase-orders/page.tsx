import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { PurchaseOrderList, PurchaseOrderListSkeleton } from "@/components/purchase-orders/purchase-order-list";
import { buttonVariants } from "@/components/ui/button";
import { PURCHASE_ORDER_STATUSES, type PurchaseOrderStatus } from "@/lib/purchase-orders/validation";

export const metadata: Metadata = { title: "Purchase orders" };

type Params = Awaited<PageProps<"/purchase-orders">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <PurchaseOrderList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (PURCHASE_ORDER_STATUSES as readonly string[]).includes(status) ? (status as PurchaseOrderStatus) : "all",
        vendorId: null,
      }}
    />
  );
}

export default function PurchaseOrdersPage({ searchParams }: PageProps<"/purchase-orders">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Purchase orders</h1>
        <Link href="/purchase-orders/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New purchase order
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/purchase-orders"
          label="Search purchase orders"
          placeholder="Search order no, vendor or mobile…"
          statusLabels={{ all: "All", open: "Open only", closed: "Closed only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<PurchaseOrderListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
