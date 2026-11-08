import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CancelExpenseForm } from "@/components/expenses/cancel-expense-form";
import { ExpenseVoucher } from "@/components/expenses/expense-voucher";
import { PrintButton } from "@/components/invoices/invoice-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpense } from "@/server/expenses";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Expense" };

async function Expense({ params }: { params: PageProps<"/expenses/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [expense, business] = await Promise.all([getExpense(id), getBusiness()]);
  if (!expense) notFound();
  const final = expense.status === "final";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{expense.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <PrintButton />
        {final && (
          <Link href={`/expenses/${expense.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        <Link href="/expenses/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another expense
        </Link>
      </div>

      {(expense.createdByName || (!final && expense.cancelReason)) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
          {expense.createdByName && <span>Recorded by {expense.createdByName}</span>}
          {!final && expense.cancelReason && <span>Cancelled: {expense.cancelReason}</span>}
        </p>
      )}

      <ExpenseVoucher expense={expense} business={business} />

      {final && <CancelExpenseForm id={expense.id} />}
    </>
  );
}

export default function ExpensePage({ params }: PageProps<"/expenses/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/expenses"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All expenses
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Expense params={params} />
      </Suspense>
    </div>
  );
}
