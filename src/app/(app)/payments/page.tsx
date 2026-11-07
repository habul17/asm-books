import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { PaymentList, PaymentListSkeleton } from "@/components/payments/payment-list";
import { buttonVariants } from "@/components/ui/button";
import type { PaymentStatusFilter } from "@/server/payments";

export const metadata: Metadata = { title: "Payments received" };

type Params = Awaited<PageProps<"/payments">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <PaymentList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as PaymentStatusFilter,
        customerId: null,
      }}
    />
  );
}

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Payments received</h1>
        <Link href="/payments/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Receive payment
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/payments"
          label="Search payments"
          placeholder="Search receipt no, customer, mobile or reference…"
          statusLabels={{ all: "All payments", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<PaymentListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
