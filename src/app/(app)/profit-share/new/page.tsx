import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { OwnerGate } from "@/components/layout/owner-gate";
import { ShareExpenseForm } from "@/components/profit-share/expense-form";
import { Skeleton } from "@/components/ui/skeleton";
import { todayInIndia } from "@/server/invoice-writes";

export const metadata: Metadata = { title: "New expense from profit" };

async function Form() {
  await connection(); // Today's date must be read per request, not at build time.
  return <ShareExpenseForm today={todayInIndia()} />;
}

export default function NewShareExpensePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link
        href="/profit-share"
        className="-my-2.5 flex w-fit items-center gap-1 py-2.5 text-sm text-muted-foreground hover:text-foreground md:my-0 md:py-0"
      >
        <ArrowLeftIcon className="size-4" /> Profit Share
      </Link>
      <h1 className="text-xl font-semibold">New expense from profit</h1>
      <OwnerGate what="set Profit Share expenses" fallback={<Skeleton className="h-80" />}>
        <Form />
      </OwnerGate>
    </div>
  );
}
