import { PlusIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CustomerList, CustomerListSkeleton } from "@/components/customers/customer-list";
import {
  CustomerPanel,
  CustomerPanelSkeleton,
  EditCustomerPanel,
  NewCustomerPanel,
} from "@/components/customers/customer-panel";
import { CustomerToolbar } from "@/components/customers/customer-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { customersHref } from "@/lib/customers/href";
import { getCustomerOptions } from "@/server/customers";

export const metadata: Metadata = { title: "Customers" };

type Params = Awaited<PageProps<"/customers">["searchParams"]>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function readParams(params: Params) {
  const rawId = first(params.id);
  const n = Number(rawId);
  const id: number | "new" | null = rawId === "new" ? "new" : Number.isSafeInteger(n) && n > 0 ? n : null;
  const groupId = Number(first(params.group));
  return {
    filters: {
      query: first(params.q).slice(0, 200),
      showInactive: first(params.inactive) === "1",
      groupId: Number.isSafeInteger(groupId) && groupId > 0 ? groupId : null,
    },
    id,
    edit: first(params.edit) === "1",
  };
}

async function Toolbar() {
  const { groups } = await getCustomerOptions();
  return <CustomerToolbar groups={groups} />;
}

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const { filters, id } = readParams(await searchParams);
  return (
    <div className={id ? "hidden md:block" : undefined}>
      <CustomerList filters={filters} selectedId={id} />
    </div>
  );
}

async function Panel({ searchParams }: { searchParams: Promise<Params> }) {
  const { filters, id, edit } = readParams(await searchParams);
  const listParams = { q: filters.query, group: filters.groupId, inactive: filters.showInactive };
  const backHref = customersHref(listParams);

  if (id === "new") return <NewCustomerPanel backHref={backHref} />;
  if (id == null) {
    return (
      <p className="hidden rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground md:block">
        Select a customer to see their details and balance.
      </p>
    );
  }
  const viewHref = customersHref({ ...listParams, id });
  if (edit) return <EditCustomerPanel id={id} backHref={backHref} viewHref={viewHref} />;
  return <CustomerPanel id={id} backHref={backHref} editHref={customersHref({ ...listParams, id, edit: true })} />;
}

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Customers</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/customers/groups" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <UsersIcon /> Groups
          </Link>
          <Link href="/customers/fields" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <SettingsIcon /> Custom fields
          </Link>
          <Link href={customersHref({ id: "new" })} scroll={false} className={buttonVariants({ size: "sm" })}>
            <PlusIcon /> New customer
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <Toolbar />
      </Suspense>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Suspense fallback={<CustomerListSkeleton />}>
          <List searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<CustomerPanelSkeleton />}>
          <Panel searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
