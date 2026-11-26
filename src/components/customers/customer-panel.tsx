import { ArrowLeftIcon, CircleArrowDownIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shownExtra } from "@/lib/custom-fields";
import { formatDate, formatMoney } from "@/lib/format";
import { getCustomer, getCustomerOptions } from "@/server/customers";
import { searchInvoices } from "@/server/invoices";
import { PayBadge } from "@/components/invoices/pay-badge";
import { CreditNoteList } from "@/components/credit-notes/credit-note-list";
import { searchPayments } from "@/server/payments";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";

import { Balance } from "./balance";
import { CustomerForm } from "./customer-form";
import { DeleteCustomerButton } from "./delete-customer-button";
import { viewerIsOwner } from "@/server/auth";
import { getBusiness } from "@/server/settings";
import { customerPending, getWhatsappTemplates } from "@/server/whatsapp-templates";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { billScanReady } from "@/server/bill-scan";

/**
 * The glass card every panel sits in. `data-customer-panel` lets the page hide its header and
 * search on a phone while a customer is open. On a laptop it lines up with the list's card.
 */
const PANEL = "glass flex flex-col gap-6 rounded-3xl p-4 sm:p-6 md:mt-8";

/** A white inset group inside the card, like an iPhone settings group. */
const GROUP = "overflow-hidden rounded-2xl border border-foreground/5 bg-white/70 dark:bg-white/[0.06]";

const PILL = (variant: "outline" | "default" = "outline") =>
  cn(buttonVariants({ variant, size: "sm" }), "rounded-full");

/** One detail line: label on the left, value on the right; a long value (the address) goes underneath. */
function Fact({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cn("flex gap-x-6 gap-y-0.5 px-4 py-3", stacked ? "flex-col" : "items-baseline justify-between")}>
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 text-sm break-words whitespace-pre-line", !stacked && "text-right")}>{children}</dd>
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="-my-2.5 flex w-fit items-center gap-1 py-2.5 text-sm font-medium text-tint md:hidden"
    >
      <ArrowLeftIcon className="size-4" /> {label}
    </Link>
  );
}

function NotFound({ backHref }: { backHref: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground md:mt-8">
      This customer could not be found.{" "}
      <Link href={backHref} className="underline underline-offset-4">
        Back to customers
      </Link>
    </p>
  );
}

export async function NewCustomerPanel({ backHref }: { backHref: string }) {
  const options = await getCustomerOptions();
  return (
    <section data-customer-panel aria-label="New customer" className={PANEL}>
      <div className="flex flex-col gap-2">
        <BackLink href={backHref} label="Customers" />
        <h2 className="text-2xl font-semibold tracking-tight">New customer</h2>
      </div>
      <CustomerForm customer={null} options={options} cancelHref={backHref} scanReady={billScanReady()} />
    </section>
  );
}

export async function EditCustomerPanel({ id, backHref, viewHref }: { id: number; backHref: string; viewHref: string }) {
  const [customer, options] = await Promise.all([getCustomer(id), getCustomerOptions()]);
  if (!customer) return <NotFound backHref={backHref} />;
  return (
    <section data-customer-panel aria-label={`Edit ${customer.name}`} className={PANEL}>
      <div className="flex flex-col gap-2">
        <BackLink href={viewHref} label="Back" />
        <h2 className="text-2xl font-semibold tracking-tight break-words">Edit {customer.name}</h2>
      </div>
      <CustomerForm key={customer.id} customer={customer} options={options} cancelHref={viewHref} />
    </section>
  );
}

function paymentTerms(days: number | null) {
  if (days == null) return null;
  return days === 0 ? "Pay on the spot" : `${days} days`;
}

export async function CustomerPanel({ id, backHref, editHref }: { id: number; backHref: string; editHref: string }) {
  const [c, options, owner, business, templates, pending] = await Promise.all([
    getCustomer(id),
    getCustomerOptions(),
    viewerIsOwner(),
    getBusiness(),
    getWhatsappTemplates(),
    customerPending(id),
  ]);
  if (!c) return <NotFound backHref={backHref} />;
  const extras = shownExtra(options.fields, c.extra);
  const settled = Math.abs(c.balance) < 0.005;
  const address = [c.address, [c.city, c.pincode].filter(Boolean).join(" - ")].filter(Boolean).join("\n");

  // Only the details that are filled in; empty ones would just be a column of dashes.
  const facts: { label: string; value: ReactNode; stacked?: boolean }[] = [
    { label: "Contact person", value: c.contactPerson },
    { label: "GSTIN", value: c.gstin && <span className="font-mono">{c.gstin}</span> },
    { label: "Address", value: address, stacked: true },
    { label: "State", value: c.stateName && `${c.stateName} (${c.stateCode})` },
    {
      label: "Price list",
      value: c.priceList && (
        <>
          {c.priceList.name}
          {!c.priceList.enabled && " (off)"}
          {c.priceList.fromGroup && <span className="text-muted-foreground"> · from group</span>}
        </>
      ),
    },
    { label: "Opening balance", value: c.openingBalance === 0 ? null : <Balance amount={c.openingBalance} /> },
    ...extras.map((e) => ({ label: e.label, value: e.value })),
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <section data-customer-panel aria-label={c.name} className={cn(PANEL, "md:sticky md:top-6")}>
      <div className="flex flex-col gap-3">
        <BackLink href={backHref} label="Customers" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-2xl font-semibold tracking-tight break-words">{c.name}</h2>
            {(!c.active || c.groupName) && (
              <div className="flex flex-wrap gap-1.5">
                {!c.active && <Badge variant="outline">inactive</Badge>}
                {c.groupName && <Badge variant="secondary">{c.groupName}</Badge>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={editHref} scroll={false} className={PILL()}>
              <PencilIcon /> Edit
            </Link>
            {owner && <DeleteCustomerButton id={c.id} active={c.active} />}
          </div>
        </div>
        {(c.mobile || c.email) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {c.mobile && (
              <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 hover:underline">
                <PhoneIcon className="size-3.5 text-muted-foreground" /> {c.mobile}
              </a>
            )}
            <WhatsAppButton
              mobile={c.mobile}
              kind="customer"
              name={c.name}
              balance={c.balance > 0.005 ? formatMoney(c.balance) : null}
              shop={business.name}
              templates={templates}
              pending={pending}
            />
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:underline">
                <MailIcon className="size-3.5 text-muted-foreground" /> {c.email}
              </a>
            )}
          </div>
        )}
      </div>

      <div className={cn(GROUP, "flex flex-col gap-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{settled ? "Balance" : c.balance > 0 ? "To receive" : "To pay"}</span>
          <span
            className={cn(
              "text-3xl font-semibold tracking-tight tabular-nums",
              settled && "text-muted-foreground",
              c.balance < -0.005 && "text-good",
            )}
          >
            {settled ? "Settled" : formatMoney(Math.abs(c.balance))}
          </span>
        </div>
        {c.overCreditLimit && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <TriangleAlertIcon className="size-4 shrink-0" /> Over credit limit
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Credit limit</dt>
            <dd className="text-sm tabular-nums">{c.creditLimit != null ? formatMoney(c.creditLimit) : "No limit"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Payment terms</dt>
            <dd className="text-sm">{paymentTerms(c.paymentTermsDays) ?? "Not set"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 max-sm:*:grow">
          {c.active && (
            <Link
              href={`/invoices/new?customer=${c.id}`}
              className={cn(PILL("default"), "shadow-[0_6px_20px_rgb(0_113_227/0.28)]")}
            >
              <PlusIcon /> New invoice
            </Link>
          )}
          <Link href={`/payments/new?customer=${c.id}`} className={PILL()}>
            <CircleArrowDownIcon /> Receive payment
          </Link>
        </div>
      </div>

      {/* Always shown, so there is a clear place to jot down how this customer likes to deal. */}
      <section className="flex flex-col gap-2">
        <h3 className="px-1 font-semibold">Notes</h3>
        {c.notes ? (
          <p className={cn(GROUP, "px-4 py-3 text-sm break-words whitespace-pre-line")}>{c.notes}</p>
        ) : (
          <p className="rounded-2xl border border-dashed border-foreground/15 p-4 text-sm text-muted-foreground">
            No notes yet.{" "}
            <Link href={editHref} scroll={false} className="font-medium text-tint hover:underline">
              Add a note
            </Link>
          </p>
        )}
      </section>

      {facts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 font-semibold">Details</h3>
          <dl className={cn(GROUP, "divide-y divide-foreground/[0.07]")}>
            {facts.map((f) => (
              <Fact key={f.label} label={f.label} stacked={f.stacked}>
                {f.value}
              </Fact>
            ))}
          </dl>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="px-1 font-semibold">Invoices</h3>
        <CustomerInvoices customerId={c.id} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 font-semibold">Payments received</h3>
        <CustomerPayments customerId={c.id} />
      </section>

      <CustomerReturns customerId={c.id} />
    </section>
  );
}

const RECENT_INVOICES = 20;

/** A tappable line in an inset list: number and date on the left, amount on the right. */
const ROW = "flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.04]";

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-foreground/15 p-4 text-sm text-muted-foreground">{children}</p>
  );
}

function ShowingLatest({ shown, count }: { shown: number; count: number }) {
  if (count <= shown) return null;
  return <p className="px-1 text-xs text-muted-foreground">Showing the latest {shown} of {count}.</p>;
}

async function CustomerInvoices({ customerId }: { customerId: number }) {
  const { count, items } = await searchInvoices({ query: "", status: "all", customerId }, RECENT_INVOICES);
  if (items.length === 0) return <Empty>No invoices yet.</Empty>;
  return (
    <div className="flex flex-col gap-1.5">
      <ul className={cn(GROUP, "divide-y divide-foreground/[0.07] text-sm")}>
        {items.map((inv) => (
          <li key={inv.id}>
            <Link href={`/invoices/${inv.id}`} className={cn(ROW, inv.status === "cancelled" && "text-muted-foreground")}>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  <span className="font-mono text-xs">{inv.number}</span>
                  <span className="text-muted-foreground"> · {formatDate(inv.date)}</span>
                </span>
                {inv.status === "cancelled" ? (
                  <Badge variant="destructive">cancelled</Badge>
                ) : inv.pay ? (
                  <PayBadge pay={inv.pay} withDue={inv.pay.status !== "unpaid"} />
                ) : (
                  <Badge variant="secondary">cash</Badge>
                )}
              </span>
              <span className={cn("shrink-0 font-medium tabular-nums", inv.status === "cancelled" && "line-through")}>
                {formatMoney(inv.grandTotal)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ShowingLatest shown={items.length} count={count} />
    </div>
  );
}

async function CustomerPayments({ customerId }: { customerId: number }) {
  const { count, items } = await searchPayments({ query: "", status: "all", customerId }, RECENT_INVOICES);
  if (items.length === 0) return <Empty>No payments yet.</Empty>;
  return (
    <div className="flex flex-col gap-1.5">
      <ul className={cn(GROUP, "divide-y divide-foreground/[0.07] text-sm")}>
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/payments/${p.id}`} className={cn(ROW, p.status === "cancelled" && "text-muted-foreground")}>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  <span className="font-mono text-xs">{p.number}</span>
                  <span className="text-muted-foreground"> · {formatDate(p.date)}</span>
                </span>
                {p.status === "cancelled" ? (
                  <Badge variant="destructive">cancelled</Badge>
                ) : (
                  <Badge variant="secondary">{PAYMENT_MODE_LABELS[p.mode]}</Badge>
                )}
              </span>
              <span className={cn("shrink-0 font-medium tabular-nums", p.status === "cancelled" && "line-through")}>
                {formatMoney(p.amount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ShowingLatest shown={items.length} count={count} />
    </div>
  );
}

function CustomerReturns({ customerId }: { customerId: number }) {
  return (
    <CreditNoteList
      filters={{ query: "", status: "all", customerId }}
      limit={RECENT_INVOICES}
      compact
      title="Returns (credit notes)"
    />
  );
}

export function CustomerPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-foreground/5 p-6 md:mt-8">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
