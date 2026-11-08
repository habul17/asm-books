import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ExpenseList, ExpenseListSkeleton } from "@/components/expenses/expense-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import type { ExpenseStatusFilter } from "@/server/expenses";

export const metadata: Metadata = { title: "Expenses" };

type Params = Awaited<PageProps<"/expenses">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <ExpenseList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as ExpenseStatusFilter,
      }}
    />
  );
}

export default function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Link href="/expenses/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New expense
        </Link>
      </div>
      <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
        <ListToolbar
          path="/expenses"
          label="Search expenses"
          placeholder="Search category, paid to, number or notes…"
          statusLabels={{ all: "All expenses", final: "Active only", cancelled: "Cancelled only" }}
        />
      </Suspense>
      <Suspense fallback={<ExpenseListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
