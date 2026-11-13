import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelMoneyEntryForm } from "@/components/banking/cancel-money-entry-form";
import { OwnerGate } from "@/components/layout/owner-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MONEY_KIND_INFO } from "@/lib/banking/entries";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { getMoneyEntry } from "@/server/money-entries";

export const metadata: Metadata = { title: "Banking entry" };

async function Entry({ params }: { params: PageProps<"/banking/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const entry = await getMoneyEntry(id);
  if (!entry) notFound();
  const info = MONEY_KIND_INFO[entry.kind];
  const final = entry.status === "final";
  const rows: [string, string][] = [
    ["Date", formatDate(entry.date)],
    [
      info.flow === "in" ? "Received by" : info.flow === "out" ? "Paid by" : "Moved",
      entry.mode ? PAYMENT_MODE_LABELS[entry.mode] : entry.kind === "deposit" ? "Cash box → bank" : "Bank → cash box",
    ],
    ...(entry.party ? [[info.party || "Name", entry.party] as [string, string]] : []),
    ...(entry.reference ? [["Reference", entry.reference] as [string, string]] : []),
    ...(entry.notes ? [["Notes", entry.notes] as [string, string]] : []),
    ...(entry.createdByName ? [["Entered by", entry.createdByName] as [string, string]] : []),
    ...(!final && entry.cancelReason ? [["Cancelled because", entry.cancelReason] as [string, string]] : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          {info.label}
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <Link href="/banking/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another entry
        </Link>
      </div>
      <p className={`text-3xl font-semibold tabular-nums ${final ? "" : "line-through opacity-60"}`}>{formatMoney(entry.amount)}</p>
      <dl className="divide-y rounded-xl border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
      {final && <CancelMoneyEntryForm id={entry.id} />}
    </>
  );
}

export default function MoneyEntryPage({ params }: PageProps<"/banking/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/banking" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Banking
      </Link>
      <OwnerGate what="see Banking" fallback={<Skeleton className="h-72" />}>
        <Entry params={params} />
      </OwnerGate>
    </div>
  );
}
