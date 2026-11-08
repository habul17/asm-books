import type { Metadata } from "next";
import { Suspense } from "react";

import { ExpenseFormSkeleton, NewExpenseForm } from "@/components/expenses/expense-loaders";

export const metadata: Metadata = { title: "New expense" };

export default function NewExpensePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New expense</h1>
      <Suspense fallback={<ExpenseFormSkeleton />}>
        <NewExpenseForm />
      </Suspense>
    </div>
  );
}
