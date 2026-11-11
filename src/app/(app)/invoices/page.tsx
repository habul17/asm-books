import { PlusIcon, SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { InvoiceList, InvoiceListSkeleton } from "@/components/invoices/invoice-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import type { InvoiceStatusFilter } from "@/server/invoices";

export const metadata: Metadata = { title: "Invoices" };

type Params = Awaited<PageProps<"/invoices">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <InvoiceList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as InvoiceStatusFilter,
        customerId: null,
      }}
    />
  );
}

export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices/fields" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <SettingsIcon /> Custom fields
          </Link>
          <Link href="/invoices/new" className={buttonVariants({ size: "sm" })}>
            <PlusIcon /> New invoice
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/invoices"
          label="Search invoices"
          placeholder="Search invoice no, customer or mobile…"
          statusLabels={{ all: "All invoices", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<InvoiceListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
