import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/validation";
import { getExpense, usedExpenseCategories } from "@/server/expenses";
import { todayInIndia } from "@/server/invoice-writes";
import { vendorOptions } from "@/server/vendors";

import { ExpenseForm } from "./expense-form";

/** Suggested categories first, then any others used before (without repeats). */
async function categoryOptions() {
  const used = await usedExpenseCategories();
  const seen = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.toLowerCase()));
  return [...EXPENSE_CATEGORIES, ...used.filter((c) => !seen.has(c.toLowerCase()))];
}

export async function NewExpenseForm() {
  await connection(); // Today's date must be read per request, not at build time.
  const [categories, vendors] = await Promise.all([categoryOptions(), vendorOptions()]);
  return (
    <ExpenseForm
      id={null}
      initial={{
        date: todayInIndia(),
        category: "",
        paidTo: "",
        vendorId: null,
        amount: null,
        gstRate: 0,
        mode: "cash",
        reference: "",
        notes: "",
      }}
      categories={categories}
      vendors={vendors}
      backHref="/expenses"
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
