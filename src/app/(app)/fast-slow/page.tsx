import type { Metadata } from "next";
import { Suspense } from "react";

import { MovementList } from "@/components/stock/movement-list";
import { Skeleton } from "@/components/ui/skeleton";
import { readPeriod } from "@/lib/stock/movement";
import { stockMovement } from "@/server/movement";

export const metadata: Metadata = { title: "Fast & Slow" };

async function Body({ searchParams }: { searchParams: PageProps<"/fast-slow">["searchParams"] }) {
  const days = readPeriod((await searchParams).days);
  const { rows } = await stockMovement(days);
  return <MovementList key={days} rows={rows} days={days} />;
}

export default function FastSlowPage({ searchParams }: PageProps<"/fast-slow">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Fast &amp; Slow</h1>
        <p className="text-sm text-muted-foreground">Which parts sell fast and which sit on the shelf, to decide what to buy.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
