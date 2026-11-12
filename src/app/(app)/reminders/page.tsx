import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LatePayerList, LowStockRows } from "@/components/reminders/reminder-lists";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { getReminders } from "@/server/reminders";
import { lowStock } from "@/server/reports";

export const metadata: Metadata = { title: "Reminders" };

/** How many low-stock parts are listed here; the report has them all. */
const STOCK_PREVIEW = 10;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function Body() {
  const [reminders, stock] = await Promise.all([getReminders(), lowStock(STOCK_PREVIEW)]);
  const { late, lateAmount, days, businessName } = reminders;
  return (
    <>
      {late && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Customers who have not paid</h2>
            {late.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {plural(late.length, "customer")} · {formatMoney(lateAmount)}
              </span>
            )}
          </div>
          {late.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No bill has been unpaid for {plural(days, "day")} or more.
            </p>
          ) : (
            <LatePayerList payers={late} days={days} businessName={businessName} />
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Shows bills unpaid for {plural(days, "day")} or more. Payments are counted against the oldest bills first.
            Change the days in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Low stock</h2>
          {reminders.lowStock > 0 && (
            <Link href="/reports/low-stock" className="text-sm font-medium hover:underline">
              See all {reminders.lowStock}
            </Link>
          )}
        </div>
        {stock.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing to reorder right now.
          </p>
        ) : (
          <LowStockRows items={stock.items} />
        )}
        <p className="px-1 text-xs text-muted-foreground">
          Parts that are out of stock, or at their minimum. Set a part&rsquo;s minimum on its Items page, or one level
          for all parts in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </section>
    </>
  );
}

function BodySkeleton() {
  return (
    <>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </>
  );
}

export default function RemindersPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Reminders</h1>
        <p className="text-sm text-muted-foreground">What needs your attention today.</p>
      </div>
      <Suspense fallback={<BodySkeleton />}>
        <Body />
      </Suspense>
    </div>
  );
}
