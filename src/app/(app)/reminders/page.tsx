import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReminderSettingsForm } from "@/components/business/business-forms";
import { OwnerOnlyBlock } from "@/components/layout/owner-gate";
import { LatePayerList, LowStockRows } from "@/components/reminders/reminder-lists";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { formatDate, formatMoney } from "@/lib/format";
import { getReminders } from "@/server/reminders";
import { lowStock } from "@/server/reports";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Reminders" };

/** How many low-stock parts are listed here; the report has them all. */
const STOCK_PREVIEW = 10;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function Body() {
  const [reminders, stock] = await Promise.all([getReminders(), lowStock(STOCK_PREVIEW)]);
  const { late, lateAmount, days, businessName, recurring, tasks } = reminders;
  return (
    <>
      {tasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Tasks due</h2>
            <Link href="/tasks" className="text-sm font-medium hover:underline">
              See all tasks
            </Link>
          </div>
          <ul className="flex flex-col divide-y rounded-2xl border">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href="/tasks" className="flex flex-col gap-0.5 px-4 py-3 hover:bg-muted/60">
                  <span className="font-medium break-words">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    Do by {formatDate(t.dueDate)}
                    {t.assignedName && <> · For {t.assignedName}</>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recurring.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Recurring invoices due</h2>
            <Link href="/recurring" className="text-sm font-medium hover:underline">
              See all
            </Link>
          </div>
          <ul className="flex flex-col divide-y rounded-2xl border">
            {recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="mr-auto flex min-w-0 flex-col">
                  <span className="truncate font-medium">{r.customerName}</span>
                  <span className="text-xs text-muted-foreground">
                    Due {formatDate(r.nextDate)} · {formatMoney(r.grandTotal)}
                  </span>
                </span>
                <Link href={`/invoices/new?repeat=${r.id}`} className={buttonVariants({ size: "sm" })}>
                  Create invoice
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {late && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Customers who have not paid{" "}
              <InfoTip label="About unpaid bills">
                Bills unpaid for {plural(days, "day")} or more. Payments clear the oldest bills first. Change the days in{" "}
                <a href="#reminder-settings">Reminder settings</a> at the bottom.
              </InfoTip>
            </h2>
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
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Low stock{" "}
            <InfoTip label="About low stock">
              Parts that are out of stock or at their minimum. Set a part&rsquo;s minimum on its Items page.
            </InfoTip>
          </h2>
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
      </section>
    </>
  );
}

async function ReminderSettings() {
  return <ReminderSettingsForm b={await getBusiness()} />;
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
        <h1 className="text-xl font-semibold">
          Reminders <InfoTip label="About reminders">What needs your attention today.</InfoTip>
        </h1>
      </div>
      <Suspense fallback={<BodySkeleton />}>
        <Body />
      </Suspense>
      <OwnerOnlyBlock>
        <section id="reminder-settings" className="flex scroll-mt-20 flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">Reminder settings</h2>
          <div className="rounded-2xl border bg-card p-4 sm:p-6">
            <Suspense fallback={<Skeleton className="h-24" />}>
              <ReminderSettings />
            </Suspense>
          </div>
        </section>
      </OwnerOnlyBlock>
    </div>
  );
}
