import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdjustmentForm } from "@/components/adjustments/adjustment-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth";
import { todayInIndia } from "@/server/invoice-writes";

export const metadata: Metadata = { title: "New adjustment" };

async function Form() {
  await connection(); // Today's date must be read per request, not at build time.
  await requireUser();
  return <AdjustmentForm today={todayInIndia()} />;
}

export default function NewAdjustmentPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New adjustment</h1>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Form />
      </Suspense>
    </div>
  );
}
