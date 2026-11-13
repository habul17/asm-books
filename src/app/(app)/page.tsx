import { BellIcon, ChevronRightIcon, CircleArrowDownIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { formatDate, formatMoney } from "@/lib/format";
import { getHomeSummary } from "@/server/home";
import { getReminders } from "@/server/reminders";

export const metadata: Metadata = { title: "Home" };

function Stat({ label, value, note, href }: { label: string; value: string; note: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-2xl border bg-card p-4 hover:bg-muted/60">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </Link>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What needs attention today; nothing is shown when all is well. */
async function Reminders() {
  const { late, lateAmount, lowStock, days, recurring } = await getReminders();
  const lines = [
    late && late.length > 0
      ? `${plural(late.length, "customer")} ${late.length === 1 ? "has" : "have"} not paid for ${plural(days, "day")} or more · ${formatMoney(lateAmount)}`
      : null,
    recurring.length > 0
      ? `${plural(recurring.length, "recurring invoice")} ${recurring.length === 1 ? "is" : "are"} due`
      : null,
    lowStock > 0 ? `${plural(lowStock, "part")} ${lowStock === 1 ? "is" : "are"} low on stock` : null,
  ].filter((line) => line != null);
  if (lines.length === 0) return null;
  return (
    <Link
      href="/reminders"
      className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/15"
    >
      <BellIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm font-medium">
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

async function Summary() {
  const { showTotals, sales, received, owed, recent } = await getHomeSummary();
  return (
    <>
      {showTotals && (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sales today" value={formatMoney(sales.today)} note={plural(sales.todayCount, "invoice")} href="/invoices" />
        <Stat
          label="Received today"
          value={formatMoney(received.today)}
          note={plural(received.todayCount, "payment")}
          href="/payments"
        />
        <Stat
          label="Sales this month"
          value={formatMoney(sales.month)}
          note={plural(sales.monthCount, "invoice")}
          href="/invoices"
        />
        <Stat
          label="Customers owe you"
          value={formatMoney(owed.receivable)}
          note={
            plural(owed.owingCount, "customer") + (owed.overLimit > 0 ? ` · ${owed.overLimit} over credit limit` : "")
          }
          href="/customers"
        />
      </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Latest invoices</h2>
          <Link href="/invoices" className="text-sm font-medium hover:underline">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {recent.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 hover:bg-muted/60",
                    inv.status === "cancelled" && "opacity-60",
                  )}
                >
                  <span className="truncate font-medium">{inv.customerName}</span>
                  <span className={cn("text-right font-medium tabular-nums", inv.status === "cancelled" && "line-through")}>
                    {formatMoney(inv.grandTotal)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{inv.number}</span> · {formatDate(inv.date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SummarySkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Home</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={customersHref({ id: "new" })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <UserPlusIcon /> New customer
          </Link>
          <Link href="/payments/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CircleArrowDownIcon /> Receive payment
          </Link>
          <Link href="/invoices/new" className={buttonVariants({ size: "sm" })}>
            <PlusIcon /> New invoice
          </Link>
        </div>
      </div>
      <Suspense fallback={null}>
        <Reminders />
      </Suspense>
      <Suspense fallback={<SummarySkeleton />}>
        <Summary />
      </Suspense>
    </div>
  );
}
