import type { Metadata } from "next";
import { Suspense } from "react";

import { ExpenseFormSkeleton, NewExpenseForm } from "@/components/expenses/expense-loaders";

export const metadata: Metadata = { title: "New expense" };

// Reading a receipt photo can take a few minutes when the reading service is busy.
export const maxDuration = 300;

export default function NewExpensePage({ searchParams }: PageProps<"/expenses/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New expense</h1>
      <Suspense fallback={<ExpenseFormSkeleton />}>
        <NewExpenseForm query={searchParams} />
      </Suspense>
    </div>
  );
}
