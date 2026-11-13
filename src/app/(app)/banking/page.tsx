import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MoneyEntryList, MoneyEntryListSkeleton } from "@/components/banking/money-entry-list";
import { ListToolbar } from "@/components/forms/list-toolbar";
import { OwnerGate } from "@/components/layout/owner-gate";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import type { MoneyEntryStatusFilter } from "@/server/money-entries";
import { moneyToday } from "@/server/statements";

export const metadata: Metadata = { title: "Banking" };

type Params = Awaited<PageProps<"/banking">["searchParams"]>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Balances() {
  const m = await moneyToday();
  const cards = [
    { label: "Cash in hand", value: m.cash, hint: "What should be in the shop's cash box" },
    { label: "In the bank", value: m.bank, hint: "UPI, card, cheque and bank transfers" },
    { label: "Total", value: m.total, hint: `As on ${formatDate(m.today)}` },
  ];
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border px-4 py-3">
            <dt className="text-sm text-muted-foreground">{c.label}</dt>
            <dd className={`text-2xl font-semibold tabular-nums ${c.value < 0 ? "text-destructive" : ""}`}>
              {formatMoney(c.value)}
            </dd>
            <dd className="text-xs text-muted-foreground">{c.hint}</dd>
          </div>
        ))}
      </dl>
      {!m.openingSet && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm dark:text-amber-100">
          The opening cash and bank balances are ₹0. Enter what the shop had on the day it started using ASM Books in{" "}
          <Link href="/settings/business" className="underline">
            Settings
          </Link>
          , so these figures match your cash box and your bank passbook.
        </p>
      )}
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = first(params.status);
  return (
    <MoneyEntryList
      filters={{
        query: first(params.q).slice(0, 200),
        status: (["final", "cancelled"].includes(status) ? status : "all") as MoneyEntryStatusFilter,
      }}
    />
  );
}

export default function BankingPage({ searchParams }: PageProps<"/banking">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Banking</h1>
        <Link href="/banking/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New entry
        </Link>
      </div>
      <OwnerGate what="see Banking" fallback={<Skeleton className="h-24 rounded-xl" />}>
        <Suspense fallback={<Skeleton className="h-24 rounded-xl" />}>
          <Balances />
        </Suspense>
        <p className="text-sm text-muted-foreground">
          Sales, payments, bills and expenses are counted on their own. Enter here only the money that is none of those:
          your own money, loans, GST paid, equipment, other income, and cash put in or taken from the bank.{" "}
          <Link href="/reports/cash-flow" className="underline">
            See the Cash Flow Statement
          </Link>
          .
        </p>
        <Suspense fallback={<div className="h-10 rounded-lg bg-muted" />}>
          <ListToolbar
            path="/banking"
            label="Search entries"
            placeholder="Search name, reference or notes…"
            statusLabels={{ all: "All entries", final: "Active only", cancelled: "Cancelled only" }}
          />
        </Suspense>
        <Suspense fallback={<MoneyEntryListSkeleton />}>
          <List searchParams={searchParams} />
        </Suspense>
      </OwnerGate>
    </div>
  );
}
