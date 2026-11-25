import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { OwnerGate } from "@/components/layout/owner-gate";
import { DeleteShareExpenseButton } from "@/components/profit-share/delete-expense-button";
import { ShareExpenseForm } from "@/components/profit-share/expense-form";
import { Skeleton } from "@/components/ui/skeleton";
import { todayInIndia } from "@/server/invoice-writes";
import { getShareExpense } from "@/server/profit-share";

export const metadata: Metadata = { title: "Change expense from profit" };

async function Form({ params }: { params: PageProps<"/profit-share/[id]/edit">["params"] }) {
  await connection();
  const { id } = await params;
  const expense = await getShareExpense(id);
  if (!expense) notFound();
  return (
    <>
      <ShareExpenseForm expense={expense} today={todayInIndia()} />
      <div className="border-t pt-4">
        <DeleteShareExpenseButton id={expense.id} />
      </div>
    </>
  );
}

export default function EditShareExpensePage({ params }: PageProps<"/profit-share/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link
        href="/profit-share"
        className="-my-2.5 flex w-fit items-center gap-1 py-2.5 text-sm text-muted-foreground hover:text-foreground md:my-0 md:py-0"
      >
        <ArrowLeftIcon className="size-4" /> Profit Share
      </Link>
      <h1 className="text-xl font-semibold">Change expense from profit</h1>
      <OwnerGate what="set Profit Share expenses" fallback={<Skeleton className="h-80" />}>
        <Form params={params} />
      </OwnerGate>
    </div>
  );
}
