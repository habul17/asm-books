import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductDetailPanel, ProductDetailSkeleton } from "@/components/catalogue/product-detail";
import { ProductResults, ProductResultsSkeleton } from "@/components/catalogue/product-results";
import { SearchBox } from "@/components/catalogue/search-box";

export const metadata: Metadata = { title: "Catalogue" };

type Params = { q?: string | string[]; id?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q);
  const id = Number(first(params.id)) || null;
  return (
    <div className={id ? "hidden md:block" : undefined}>
      <ProductResults query={q} selectedId={id} />
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
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
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
