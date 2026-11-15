import type { Metadata } from "next";
import { connection } from "next/server";

import { MoneyEntryForm } from "@/components/banking/money-entry-form";
import { OwnerGate } from "@/components/layout/owner-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { MONEY_KINDS } from "@/lib/banking/entries";
import { moneyPrefill } from "@/lib/payments/prefill";
import { todayInIndia } from "@/server/invoice-writes";

export const metadata: Metadata = { title: "New banking entry" };

async function Form({ searchParams }: { searchParams: PageProps<"/banking/new">["searchParams"] }) {
  await connection(); // Today's date must be read per request, not at build time.
  const query = await searchParams;
  const raw = query.kind;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const today = todayInIndia();
  return (
    <MoneyEntryForm
      today={today}
      initialKind={MONEY_KINDS.find((k) => k === asked) ?? "owner_in"}
      fill={moneyPrefill(query, today)}
    />
  );
}

export default function NewMoneyEntryPage({ searchParams }: PageProps<"/banking/new">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New banking entry</h1>
      <OwnerGate what="use Banking" fallback={<Skeleton className="h-80" />}>
        <Form searchParams={searchParams} />
      </OwnerGate>
    </div>
  );
}
