import { PlusIcon, ScanLineIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductDetailPanel, ProductDetailSkeleton } from "@/components/catalogue/product-detail";
import { ItemsTabs, ProductResults, ProductResultsSkeleton } from "@/components/catalogue/product-results";
import { SearchBox } from "@/components/catalogue/search-box";
import { RefreshButton } from "@/components/layout/refresh-button";
import { readShow } from "@/lib/stock/item-status";

export const metadata: Metadata = { title: "Items" };

type Params = { q?: string | string[]; id?: string | string[]; show?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q);
  const id = Number(first(params.id)) || null;
  const show = readShow(first(params.show));
  return (
    <div className={id ? "hidden md:flex md:flex-col md:gap-3" : "flex flex-col gap-3"}>
      <ItemsTabs query={q} show={show} />
      <ProductResults query={q} selectedId={id} show={show} />
    </div>
  );
}

async function Detail({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const id = Number(first(params.id)) || null;
  if (!id) {
    return (
      <p className="hidden rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground md:block">
        Select a product to see its prices and history.
      </p>
    );
  }
  return <ProductDetailPanel id={id} query={first(params.q)} />;
}

export default function CataloguePage({ searchParams }: PageProps<"/catalogue">) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Items</h1>
        <div className="flex items-center gap-2">
          {/* The phone has no top bar here, so its refresh button sits with the others. */}
          <RefreshButton className="size-9 rounded-full border border-border md:hidden [&_svg]:size-4" />
          <Link
            href="/catalogue/rate-list"
            aria-label="Read a rate list"
            title="Read a rate list"
            className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-muted/60"
          >
            <ScanLineIcon className="size-4" />
          </Link>
          <Link
            href="/catalogue/new"
            aria-label="Add part"
            title="Add part"
            className="flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85"
          >
            <PlusIcon className="size-4" />
          </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-10 rounded-xl bg-muted" />}>
        <SearchBox />
      </Suspense>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Suspense fallback={<ProductResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<ProductDetailSkeleton />}>
          <Detail searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
