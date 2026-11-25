import { ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionTip } from "@/components/layout/section-tips";
import { OwnerGate } from "@/components/layout/owner-gate";
import { ScrollHere } from "@/components/profit-share/scroll-here";
import { ShareCard } from "@/components/profit-share/share-card";
import { PeriodCaption } from "@/components/reports/period-caption";
import { PeriodPicker, periodParams, ReportSkeleton } from "@/components/reports/report-parts";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { hasEnded, PARTNER_NAMES, PARTNERS, scheduleLabel } from "@/lib/profit-share/share";
import { PERIOD_PRESETS_WITH_6_MONTHS } from "@/lib/reports/period";
import { todayInIndia } from "@/server/invoice-writes";
import { getProfitShare, type ProfitShareData } from "@/server/profit-share";
import { readPeriod } from "@/server/reports";

export const metadata: Metadata = { title: "Profit Share" };

const PATH = "/profit-share";
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const monthName = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00Z`));

/** One line per month of the period; each opens that month in full. */
function Months({ months }: { months: ProfitShareData["months"] }) {
  const cell = "px-2 py-2.5 text-right whitespace-nowrap tabular-nums sm:px-4";
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">Month by month</h2>
      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full text-xs sm:text-sm">
          <caption className="sr-only">Money received, profit, and each partner&apos;s final profit, by month</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="px-2 py-2.5 text-left font-medium sm:px-4">
                Month
              </th>
              <th scope="col" className={`${cell} font-medium max-sm:hidden`}>
                Received
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Profit
              </th>
              {PARTNERS.map((p) => (
                <th key={p} scope="col" className={`${cell} font-medium`}>
                  {PARTNER_NAMES[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="px-2 py-2.5 text-left font-medium whitespace-nowrap sm:px-4">
                  <Link href={`${PATH}?from=${m.from}&to=${m.to}`} className="underline-offset-2 hover:underline">
                    {monthName(m.month)}
                  </Link>
                </th>
                <td className={`${cell} max-sm:hidden`}>{formatMoney(m.received)}</td>
                <td className={`${cell} ${m.profit < 0 ? "text-destructive" : ""}`}>{formatMoney(m.profit)}</td>
                {PARTNERS.map((p) => (
                  <td key={p} className={`${cell} font-medium ${m[p].final < 0 ? "text-destructive" : ""}`}>
                    {formatMoney(m[p].final)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        {PARTNER_NAMES.ashi} and {PARTNER_NAMES.dad}: final profit, after expenses. Tap a month to see it in full.
      </p>
    </section>
  );
}

/** The expenses taken from the partners' halves, with how often each fell in the dates on screen. */
function Expenses({ data, today }: { data: ProfitShareData; today: string }) {
  return (
    <section id="expenses" className="flex scroll-mt-20 flex-col gap-2">
      <ScrollHere id="expenses" />
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-muted-foreground">Expenses from profit</h2>
        <Link href={`${PATH}/new`} className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Add expense
        </Link>
      </div>
      {data.expenses.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-foreground/15 p-6 text-center text-sm text-muted-foreground">
          No expenses yet. Add one to take it off {PARTNER_NAMES.ashi}&apos;s or {PARTNER_NAMES.dad}&apos;s half, like{" "}
          {formatMoney(1500)} from each every month.
        </p>
      ) : (
        <ul className="glass divide-y divide-foreground/[0.07] overflow-hidden rounded-3xl">
          {data.expenses.map((e) => {
            const times = data.counted[e.id] ?? 0;
            return (
              <li key={e.id}>
                <Link
                  href={`${PATH}/${e.id}/edit`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.04] sm:px-6"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium break-words">{e.name}</span>
                    <span className="text-sm tabular-nums">
                      {PARTNERS.map((p) => `${PARTNER_NAMES[p]} ${formatMoney(e[p])}`).join(" · ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {scheduleLabel(e)}
                      {hasEnded(e, today) ? " · ended" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {times === 0
                        ? "Not taken off in these dates"
                        : times === 1
                          ? "Taken off once in these dates"
                          : `Taken off ${times} times in these dates`}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/profit-share">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams), PERIOD_PRESETS_WITH_6_MONTHS);
  const data = await getProfitShare(period);
  return (
    <>
      <PeriodPicker path={PATH} period={period} presets={PERIOD_PRESETS_WITH_6_MONTHS} />
      <PeriodCaption period={period} />
      <ShareCard figures={data} share={data} />
      {data.months.length > 1 && <Months months={data.months} />}
      <Expenses data={data} today={todayInIndia()} />
    </>
  );
}

export default function ProfitSharePage({ searchParams }: PageProps<"/profit-share">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold max-md:sr-only">
        Profit Share <SectionTip href={PATH} />
      </h1>
      <OwnerGate what="see Profit Share" fallback={<ReportSkeleton />}>
        <Suspense fallback={<ReportSkeleton />}>
          <Body searchParams={searchParams} />
        </Suspense>
      </OwnerGate>
    </div>
  );
}
