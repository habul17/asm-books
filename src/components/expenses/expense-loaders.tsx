import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { moneyPrefill } from "@/lib/payments/prefill";
import { billScanReady } from "@/server/bill-scan";
import { expenseCategoryOptions as categoryOptions } from "@/server/bill-scan/receipt";
import { getExpense } from "@/server/expenses";
import { todayInIndia } from "@/server/invoice-writes";
import { vendorOptions } from "@/server/vendors";

import { ExpenseForm } from "./expense-form";

export async function NewExpenseForm({ query }: { query: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // Today's date must be read per request, not at build time.
  const today = todayInIndia();
  const fill = moneyPrefill(await query, today);
  const [categories, vendors] = await Promise.all([categoryOptions(), vendorOptions()]);
  return (
    <ExpenseForm
      id={null}
      initial={{
        date: fill.date ?? today,
        category: fill.category,
        paidTo: "",
        vendorId: null,
        amount: fill.amount,
        gstRate: 0,
        mode: fill.mode ?? "cash",
        reference: fill.reference,
        notes: fill.notes,
      }}
      categories={categories}
      vendors={vendors}
      backHref="/expenses"
      scanReady={billScanReady()}
    />
  );
}

export async function EditExpenseForm({ id }: { id: number }) {
  const [expense, categories] = await Promise.all([getExpense(id), categoryOptions()]);
  if (!expense || expense.status === "cancelled") notFound();
  const vendors = await vendorOptions(expense.vendorId);
  return (
    <ExpenseForm
      id={expense.id}
      initial={{
        date: expense.date,
        category: expense.category,
        paidTo: expense.paidTo ?? "",
        vendorId: expense.vendorId,
        amount: expense.amount,
        gstRate: expense.gstRate,
        mode: expense.mode,
        reference: expense.reference ?? "",
        notes: expense.notes ?? "",
      }}
      categories={categories}
      vendors={vendors}
      backHref={`/expenses/${expense.id}`}
    />
  );
}

export function ExpenseFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-20" />
    </div>
  );
}
