import { BellIcon, ChevronRightIcon, CircleArrowDownIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AgingCard, CardHead, Change, MonthChart, Rows, Section, Tile } from "@/components/home/dashboard";
import { PartPhoto } from "@/components/catalogue/part-photo";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { getHomeDashboard, type HomeDashboard } from "@/server/home";
import { getReminders } from "@/server/reminders";

export const metadata: Metadata = { title: "Home" };

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

type Figures = NonNullable<HomeDashboard["figures"]>;

function Today({ f }: { f: Figures }) {
  return (
    <Section title="Today">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Sales" value={formatMoney(f.today.sales)} note={plural(f.today.invoices, "invoice")} href="/invoices" />
        <Tile
          label="Received"
          value={formatMoney(f.today.received)}
          note={`${formatMoney(f.today.cashSales)} cash sales + ${plural(f.today.payments, "payment")}`}
          href="/payments"
        />
      </div>
    </Section>
  );
}

function ThisMonth({ f }: { f: Figures }) {
  const { now, before, comparedTo } = f.month;
  const tiles = [
    { label: "Sales", key: "sales", href: "/reports/sales" },
    { label: "Purchases", key: "purchases", href: "/bills" },
    { label: "Expenses", key: "expenses", href: "/reports/expenses-by-category" },
    { label: "Profit", key: "profit", href: "/reports/profit-and-loss" },
  ] as const;
  return (
    <Section title="This month" note={`Compared with ${formatDate(comparedTo.from)} to ${formatDate(comparedTo.to)}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            label={t.label}
            value={formatMoney(now[t.key])}
            note={<Change now={now[t.key]} before={before[t.key]} />}
            href={t.href}
            negative={now[t.key] < 0}
          />
        ))}
      </div>
    </Section>
  );
}

function Earned({ f }: { f: Figures }) {
  const e = f.earned;
  return (
    <Section title="Profit from money received" note="This month">
      <Rows
        rows={[
          {
            label: "Money received",
            note: `${formatMoney(e.cashSales)} cash sales + ${formatMoney(e.payments)} payments`,
            value: formatMoney(e.received),
            href: "/payments",
          },
          {
            label: "Profit in it",
            note:
              e.untraced > 0
                ? `${formatMoney(e.untraced)} was for old dues, advances or parts without a cost, not counted`
                : "Before GST",
            value: formatMoney(e.profit),
            href: "/payments",
            strong: true,
            negative: e.profit < 0,
          },
          { label: "Ashi", note: "50% of the profit", value: formatMoney(e.ashi), href: "/payments", negative: e.ashi < 0 },
          { label: "Dad", note: "50% of the profit", value: formatMoney(e.dad), href: "/payments", negative: e.dad < 0 },
        ]}
      />
    </Section>
  );
}

function OwedAndOwing({ f }: { f: Figures }) {
  const p = f.payable;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Money to collect">
        <AgingCard
          total={f.receivable.total}
          customers={f.receivable.customers}
          buckets={f.receivable.buckets}
          href="/reports/ar-aging"
        />
      </Section>
      <Section title="Money to pay">
        <Rows
          header={<CardHead label="You owe vendors" value={formatMoney(p.total)} note={plural(p.vendors, "vendor")} />}
          rows={[
            {
              label: "Overdue",
              note: "Bills past their due date",
              value: formatMoney(p.overdue),
              href: "/reports/vendor-balances",
              negative: p.overdue > 0,
            },
            {
              label: "Due in the next 7 days",
              value: formatMoney(p.dueThisWeek),
              href: "/reports/vendor-balances",
            },
          ]}
        />
      </Section>
    </div>
  );
}

function MoneyAndGst({ f }: { f: Figures }) {
  const g = f.gst;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Cash and bank">
        <Rows
          rows={[
            { label: "Cash in hand", value: formatMoney(f.money.cash), href: "/banking", negative: f.money.cash < 0 },
            { label: "In the bank", value: formatMoney(f.money.bank), href: "/banking", negative: f.money.bank < 0 },
            {
              label: "Total",
              note: f.money.openingSet ? undefined : "Opening balances not entered yet",
              value: formatMoney(f.money.total),
              href: "/banking",
              strong: true,
              negative: f.money.total < 0,
            },
          ]}
        />
      </Section>
      <Section title="GST this month">
        <Rows
          rows={[
            { label: "GST on sales", value: formatMoney(g.output), href: "/reports/gst" },
            { label: "GST on purchases and expenses", value: formatMoney(g.input), href: "/reports/gst" },
            g.payable >= 0
              ? { label: "GST to pay", value: formatMoney(g.payable), href: "/reports/gst", strong: true }
              : { label: "GST credit to carry forward", value: formatMoney(-g.payable), href: "/reports/gst", strong: true },
          ]}
        />
      </Section>
    </div>
  );
}

function Stock({ d }: { d: HomeDashboard }) {
  const s = d.stock;
  return (
    <Section title="Stock">
      <Rows
        rows={[
          ...(s.value != null
            ? [
                {
                  label: "Stock value",
                  note: `${plural(s.parts, "part")} in stock, at purchase price`,
                  value: formatMoney(s.value),
                  href: "/stock",
                },
              ]
            : []),
          { label: "Low on stock", note: "A few left", value: String(s.low - s.out), href: "/reports/low-stock" },
          { label: "Out of stock", value: String(s.out), href: "/reports/low-stock", negative: s.out > 0 },
          ...(s.slowValue != null
            ? [
                {
                  label: "Not sold in 90 days",
                  note: plural(s.slowCount, "part"),
                  value: formatMoney(s.slowValue),
                  href: "/reports/slow-stock",
                },
              ]
            : []),
        ]}
      />
    </Section>
  );
}

function TopLists({ f }: { f: Figures }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Top parts this month" note="By quantity sold">
        {f.topParts.length === 0 ? (
          <Empty>No parts sold yet this month.</Empty>
        ) : (
          <Rows
            rows={f.topParts.map((p) => ({
              icon: <PartPhoto photo={p.photo} />,
              label: p.description,
              note: <span className="font-mono">{p.partNo}</span>,
              value: `${formatQty(p.qty)} ${p.unit}`,
              href: `/catalogue?id=${p.id}`,
            }))}
          />
        )}
      </Section>
      <Section title="Top customers this month" note="By sales">
        {f.topCustomers.length === 0 ? (
          <Empty>No sales yet this month.</Empty>
        ) : (
          <Rows
            rows={f.topCustomers.map((c) => ({
              label: c.name,
              note: plural(c.count, "invoice"),
              value: formatMoney(c.value),
              href: c.id == null ? "/reports/sales-by-customer" : customersHref({ id: c.id }),
            }))}
          />
        )}
      </Section>
    </div>
  );
}

function OpenOrders({ d }: { d: HomeDashboard }) {
  const { sales, purchase } = d.orders;
  const figure = (o: { value: number | null }) => (o.value == null ? undefined : formatMoney(o.value));
  return (
    <Section title="Open orders">
      <Rows
        rows={[
          {
            label: "Customer orders",
            note: `${plural(sales.count, "order")} not billed yet`,
            value: figure(sales),
            href: "/sales/orders?status=open",
          },
          {
            label: "Purchase orders",
            note: `${plural(purchase.count, "order")} not received yet`,
            value: figure(purchase),
            href: "/purchase-orders?status=open",
          },
        ]}
      />
    </Section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

async function Dashboard() {
  const d = await getHomeDashboard();
  const f = d.figures;
  if (!f) {
    return (
      <>
        <Stock d={d} />
        <OpenOrders d={d} />
      </>
    );
  }
  return (
    <>
      <Today f={f} />
      <ThisMonth f={f} />
      <Earned f={f} />
      <OwedAndOwing f={f} />
      <Section title="Sales and purchases" note="Last 6 months, with GST">
        <MonthChart rows={f.chart} href="/reports/sales" />
      </Section>
      <MoneyAndGst f={f} />
      <Stock d={d} />
      <TopLists f={f} />
      <OpenOrders d={d} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
