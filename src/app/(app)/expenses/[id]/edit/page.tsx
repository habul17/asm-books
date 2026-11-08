import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditExpenseForm, ExpenseFormSkeleton } from "@/components/expenses/expense-loaders";

export const metadata: Metadata = { title: "Edit expense" };

async function Form({ params }: { params: PageProps<"/expenses/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <EditExpenseForm id={id} />;
}

export default function EditExpensePage({ params }: PageProps<"/expenses/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit expense</h1>
      <Suspense fallback={<ExpenseFormSkeleton />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
