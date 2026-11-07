import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { VendorList, VendorListSkeleton } from "@/components/vendors/vendor-list";

export const metadata: Metadata = { title: "Vendors" };

type Params = Awaited<PageProps<"/vendors">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return <VendorList filters={{ query: first(params.q).slice(0, 200), showInactive: true }} />;
}

export default function VendorsPage({ searchParams }: PageProps<"/vendors">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Vendors</h1>
        <Link href="/vendors/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New vendor
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar path="/vendors" label="Search vendors" placeholder="Search name, mobile, GSTIN or city…" />
      </Suspense>
      <Suspense fallback={<VendorListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
