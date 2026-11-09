import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdjustmentForm } from "@/components/adjustments/adjustment-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdjustment } from "@/server/adjustments";

export const metadata: Metadata = { title: "Edit adjustment" };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

async function Form({ params }: { params: PageProps<"/inventory-adjustments/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const adj = await getAdjustment(id);
  if (!adj || adj.status === "cancelled") notFound();
  return (
    <>
      <p className="font-mono text-sm text-muted-foreground">{adj.number}</p>
      <AdjustmentForm
        initial={{
          id: adj.id,
          date: adj.date,
          reason: adj.reason,
          notes: adj.notes ?? "",
          lines: adj.lines.map((l) => ({
            // Show each part's stock as it would be without this adjustment.
            item: {
              id: l.productId,
              partNo: l.partNo ?? "",
              description: l.description,
              unit: l.unit,
              stockQty: round3(l.stockNow - l.qty),
            },
            qty: l.qty,
          })),
        }}
      />
    </>
  );
}

export default function EditAdjustmentPage({ params }: PageProps<"/inventory-adjustments/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit adjustment</h1>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
