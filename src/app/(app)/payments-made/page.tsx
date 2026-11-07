import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { VendorPaymentList, VendorPaymentListSkeleton } from "@/components/payments-made/vendor-payment-list";
import { buttonVariants } from "@/components/ui/button";
import type { VendorPaymentStatusFilter } from "@/server/vendor-payments";

export const metadata: Metadata = { title: "Payments made" };

type Params = Awaited<PageProps<"/payments-made">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <VendorPaymentList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as VendorPaymentStatusFilter,
        vendorId: null,
      }}
    />
  );
}

export default function PaymentsMadePage({ searchParams }: PageProps<"/payments-made">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Payments made</h1>
        <Link href="/payments-made/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Pay a vendor
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/payments-made"
          label="Search payments made"
          placeholder="Search payment no, vendor, mobile or reference…"
          statusLabels={{ all: "All payments", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<VendorPaymentListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
