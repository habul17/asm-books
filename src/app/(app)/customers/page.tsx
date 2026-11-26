import { PlusIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";

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

// Reading a card photo for a new customer can take a few minutes when the reading service is busy.
export const maxDuration = 300;

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
      <p className="mt-8 hidden rounded-3xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground md:block">
        Select a customer to see their details and balance.
      </p>
    );
  }
  const viewHref = customersHref({ ...listParams, id });
  if (edit) return <EditCustomerPanel id={id} backHref={backHref} viewHref={viewHref} />;
  return <CustomerPanel id={id} backHref={backHref} editHref={customersHref({ ...listParams, id, edit: true })} />;
}

/** Groups and custom fields are set up once, so they sit quietly: in the header on a laptop, at the bottom on a phone. */
function SetupLinks({ className }: { className?: string }) {
  const pill = cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full");
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Link href="/customers/groups" className={pill}>
        <UsersIcon /> Groups
      </Link>
      <Link href="/customers/fields" className={pill}>
        <SettingsIcon /> Custom fields
      </Link>
    </div>
  );
}

/** On a phone, everything above the list hides while one customer is open (the panel carries data-customer-panel). */
const HIDE_WHILE_OPEN = "max-md:group-has-[[data-customer-panel]]/customers:hidden";

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <div className="group/customers flex flex-col gap-6">
      <div className={cn("flex flex-wrap items-end justify-between gap-x-3 gap-y-4", HIDE_WHILE_OPEN)}>
        <h1 className="px-1 text-[2.125rem] leading-tight font-bold tracking-tight max-md:sr-only">Customers</h1>
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:*:grow">
          <SetupLinks className="max-md:hidden" />
          <Link
            href={customersHref({ id: "new" })}
            scroll={false}
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-[0_6px_20px_rgb(0_113_227/0.28)]")}
          >
            <PlusIcon /> New customer
          </Link>
        </div>
      </div>
      <div className={HIDE_WHILE_OPEN}>
        <Suspense fallback={<div className="h-(--control-h) rounded-full bg-muted" />}>
          <Toolbar />
        </Suspense>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Suspense fallback={<CustomerListSkeleton />}>
          <List searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<CustomerPanelSkeleton />}>
          <Panel searchParams={searchParams} />
        </Suspense>
      </div>
      <SetupLinks className={cn("md:hidden *:grow", HIDE_WHILE_OPEN)} />
    </div>
  );
}
