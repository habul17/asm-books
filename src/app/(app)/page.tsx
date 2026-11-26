import {
  ChevronRightIcon,
  CircleArrowDownIcon,
  type LucideIcon,
  PackageIcon,
  PlusIcon,
  RepeatIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "cn";

import { AgingCard, CardHead, Change, MonthChart, Rows, Section, Tile } from "@/components/home/dashboard";
import { PartPhoto } from "@/components/catalogue/part-photo";
import { CardLink, ShareCard } from "@/components/profit-share/share-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { formatMoney, formatQty } from "@/lib/format";
import { getHomeDashboard, type HomeDashboard } from "@/server/home";
import { getReminders } from "@/server/reminders";

export const metadata: Metadata = { title: "Home" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Space between the sections, and between two sections that sit side by side on a laptop. */
const PAIR = "grid grid-cols-1 gap-x-6 gap-y-8 sm:gap-y-10 lg:grid-cols-2";

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

/** Today's date above the title, e.g. "Thursday, 26 November". */
async function DateLine() {
  await connection();
  return <>{DAY.format(new Date())}</>;
}

interface Reminder {
  icon: LucideIcon;
  text: string;
  value?: string;
  href: string;
}

/** What needs attention today, one tappable line each; nothing is shown when all is well. */
async function Reminders() {
  const { late, lateAmount, lowStock, days, recurring } = await getReminders();
  const items: Reminder[] = [];
  if (late && late.length > 0) {
    items.push({
      icon: UsersIcon,
      text: `${plural(late.length, "customer")} unpaid for ${days}+ days`,
      value: formatMoney(lateAmount),
      href: "/reminders",
    });
  }
  if (recurring.length > 0) {
    items.push({
      icon: RepeatIcon,
      text: `${plural(recurring.length, "recurring invoice")} ${recurring.length === 1 ? "is" : "are"} due`,
      href: "/reminders",
    });
  }
  if (lowStock > 0) {
    // The count includes parts that have run out, so say so; the Stock tiles split the two.
    items.push({
      icon: PackageIcon,
      text: `${plural(lowStock, "part")} ${lowStock === 1 ? "is" : "are"} low or out of stock`,
      href: "/reports/low-stock",
    });
  }
  if (items.length === 0) return null;
  return (
    <ul
      aria-label="Reminders"
      className="divide-y divide-amber-500/20 overflow-hidden rounded-3xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl"
    >
      {items.map(({ icon: Icon, text, value, href }) => (
        <li key={text}>
          <Link
            href={href}
            className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-amber-500/10 sm:px-6"
          >
            <Icon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="min-w-0 flex-1">{text}</span>
            {value != null && <span className="shrink-0 font-semibold tabular-nums">{value}</span>}
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Figures = NonNullable<HomeDashboard["figures"]>;

function Today({ f }: { f: Figures }) {
  return (
    <Section title="Today">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Tile
          size="lg"
          label="Sales"
          value={formatMoney(f.today.sales)}
          note={plural(f.today.invoices, "invoice")}
          href="/invoices"
        />
        <Tile
          size="lg"
          label="Received"
          value={formatMoney(f.today.received)}
          note={`${formatMoney(f.today.cashSales)} cash sales + ${plural(f.today.payments, "payment")}`}
          href="/payments"
        />
      </div>
    </Section>
  );
}

const SHORT_DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** A short span of days: "1–26 Oct", or "28 Feb – 3 Mar" when it crosses into another month. */
function dayRange(from: string, to: string) {
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const [a, b] = [day(from), day(to)];
  if (from.slice(0, 10) === to.slice(0, 10)) return SHORT_DAY.format(b);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${a.getUTCDate()}–${SHORT_DAY.format(b)}`;
  return `${SHORT_DAY.format(a)} – ${SHORT_DAY.format(b)}`;
}

function ThisMonth({ f }: { f: Figures }) {
  const { now, before, comparedTo } = f.month;
  // Which way is good news: more sales and profit, fewer expenses. Purchases are neither.
  const tiles = [
    { label: "Sales", key: "sales", href: "/reports/sales", good: "up" },
    { label: "Purchases", key: "purchases", href: "/bills", good: undefined },
    { label: "Expenses", key: "expenses", href: "/reports/expenses-by-category", good: "down" },
    { label: "Profit", key: "profit", href: "/reports/profit-and-loss", good: "up" },
  ] as const;
  return (
    <Section title="This month" note={`Compared with ${dayRange(comparedTo.from, comparedTo.to)}`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            label={t.label}
            value={formatMoney(now[t.key])}
            badge={<Change now={now[t.key]} before={before[t.key]} good={t.good} />}
            href={t.href}
            negative={now[t.key] < 0}
          />
        ))}
      </div>
    </Section>
  );
}

function Earned({ f }: { f: Figures }) {
  return (
    <Section title="Profit from money received" note="This month">
      <ShareCard
        figures={f.earned}
        share={f.earned}
        href="/profit-share"
        footer={<CardLink href="/profit-share#expenses">Set expenses for Ashi and Dad</CardLink>}
      />
    </Section>
  );
}

function OwedAndOwing({ f }: { f: Figures }) {
  const p = f.payable;
  return (
    <div className={PAIR}>
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
    <div className={PAIR}>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {s.value != null && (
          <Tile
            label="Stock value"
            value={formatMoney(s.value)}
            note={`${plural(s.parts, "part")} in stock, at actual cost`}
            href="/stock"
          />
        )}
        <Tile label="Low on stock" value={String(s.low - s.out)} note="A few left" href="/reports/low-stock" />
        <Tile label="Out of stock" value={String(s.out)} href="/reports/low-stock" negative={s.out > 0} />
        {s.slowValue != null && (
          <Tile
            label="Not sold in 90 days"
            value={formatMoney(s.slowValue)}
            note={plural(s.slowCount, "part")}
            href="/reports/slow-stock"
          />
        )}
      </div>
    </Section>
  );
}

/** A customer's first letter in a blue circle, standing in for a photo. */
function Initial({ name }: { name: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint/10 text-sm font-semibold text-tint"
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function TopLists({ f }: { f: Figures }) {
  return (
    <div className={PAIR}>
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
              icon: <Initial name={c.name} />,
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
  // No ₹0.00 when nothing is open: the note says so instead.
  const figure = (o: { count: number; value: number | null }) =>
    o.value == null || o.count === 0 ? undefined : formatMoney(o.value);
  return (
    <Section title="Open orders">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Rows
          rows={[
            {
              label: "Customer orders",
              note: sales.count === 0 ? "None waiting to be billed" : `${plural(sales.count, "order")} not billed yet`,
              value: figure(sales),
              href: "/sales/orders?status=open",
            },
          ]}
        />
        <Rows
          rows={[
            {
              label: "Purchase orders",
              note:
                purchase.count === 0 ? "None waiting to arrive" : `${plural(purchase.count, "order")} not received yet`,
              value: figure(purchase),
              href: "/purchase-orders?status=open",
            },
          ]}
        />
      </div>
    </Section>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-foreground/15 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:gap-10">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
        <div className="flex flex-col gap-0.5 px-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Suspense fallback={<span className="invisible">Today</span>}>
              <DateLine />
            </Suspense>
          </p>
          <h1 className="text-[2.125rem] leading-tight font-bold tracking-tight max-md:sr-only">Home</h1>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:*:grow">
          <Link
            href={customersHref({ id: "new" })}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
          >
            <UserPlusIcon /> New customer
          </Link>
          <Link href="/payments/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
            <CircleArrowDownIcon /> Receive payment
          </Link>
          <Link
            href="/invoices/new"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-[0_6px_20px_rgb(0_113_227/0.28)]")}
          >
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
