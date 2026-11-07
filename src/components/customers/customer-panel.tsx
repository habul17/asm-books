import { ArrowLeftIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { getCustomer, getCustomerOptions } from "@/server/customers";
import { searchInvoices } from "@/server/invoices";

import { Balance } from "./balance";
import { CustomerForm } from "./customer-form";

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex flex-col gap-0.5 sm:col-span-2" : "flex flex-col gap-0.5"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-line">{children || "—"}</dd>
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
    >
      <ArrowLeftIcon className="size-4" /> {label}
    </Link>
  );
}

function NotFound({ backHref }: { backHref: string }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
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
    <Card>
      <CardHeader className="gap-2">
        <BackLink href={backHref} label="Back to customers" />
        <CardTitle className="text-lg">New customer</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerForm customer={null} options={options} cancelHref={backHref} />
      </CardContent>
    </Card>
  );
}

export async function EditCustomerPanel({ id, backHref, viewHref }: { id: number; backHref: string; viewHref: string }) {
  const [customer, options] = await Promise.all([getCustomer(id), getCustomerOptions()]);
  if (!customer) return <NotFound backHref={backHref} />;
  return (
    <Card>
      <CardHeader className="gap-2">
        <BackLink href={viewHref} label="Back" />
        <CardTitle className="text-lg">Edit {customer.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerForm key={customer.id} customer={customer} options={options} cancelHref={viewHref} />
      </CardContent>
    </Card>
  );
}

export async function CustomerPanel({ id, backHref, editHref }: { id: number; backHref: string; editHref: string }) {
  const [c, options] = await Promise.all([getCustomer(id), getCustomerOptions()]);
  if (!c) return <NotFound backHref={backHref} />;
  const extras = options.fields
    .filter((f) => f.active && c.extra[String(f.id)] != null)
    .map((f) => {
      const v = c.extra[String(f.id)];
      return { id: f.id, label: f.label, value: f.type === "date" ? formatDate(String(v)) : String(v) };
    });

  return (
    <Card className="md:sticky md:top-18">
      <CardHeader className="gap-2">
        <BackLink href={backHref} label="Back to customers" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {c.name}
            {!c.active && <Badge variant="outline">inactive</Badge>}
            {c.groupName && <Badge variant="secondary">{c.groupName}</Badge>}
          </CardTitle>
          <Link href={editHref} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        </div>
        {(c.mobile || c.email) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {c.mobile && (
              <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 hover:underline">
                <PhoneIcon className="size-3.5 text-muted-foreground" /> {c.mobile}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:underline">
                <MailIcon className="size-3.5 text-muted-foreground" /> {c.email}
              </a>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/60 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Outstanding</span>
            <Balance amount={c.balance} className="text-lg font-semibold" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Credit limit</span>
            <span className="text-sm tabular-nums">{c.creditLimit != null ? formatMoney(c.creditLimit) : "No limit"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Payment terms</span>
            <span className="text-sm">
              {c.paymentTermsDays == null ? "—" : c.paymentTermsDays === 0 ? "Pay on the spot" : `${c.paymentTermsDays} days`}
            </span>
          </div>
          {c.overCreditLimit && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <TriangleAlertIcon className="size-4" /> Over credit limit
            </p>
          )}
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Contact person">{c.contactPerson}</Fact>
          <Fact label="GSTIN">{c.gstin && <span className="font-mono">{c.gstin}</span>}</Fact>
          <Fact label="Address" wide>
            {[c.address, [c.city, c.pincode].filter(Boolean).join(" - ")].filter(Boolean).join("\n")}
          </Fact>
          <Fact label="State">{c.stateName && `${c.stateName} (${c.stateCode})`}</Fact>
          <Fact label="Price list">
            {c.priceList && (
              <>
                {c.priceList.name}
                {!c.priceList.enabled && " (off)"}
                {c.priceList.fromGroup && <span className="text-muted-foreground"> · from group</span>}
              </>
            )}
          </Fact>
          <Fact label="Opening balance">
            {c.openingBalance === 0 ? null : <Balance amount={c.openingBalance} />}
          </Fact>
          {extras.map((e) => (
            <Fact key={e.id} label={e.label}>
              {e.value}
            </Fact>
          ))}
          {c.notes && (
            <Fact label="Notes" wide>
              {c.notes}
            </Fact>
          )}
        </dl>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Invoices</h3>
            {c.active && (
              <Link href={`/invoices/new?customer=${c.id}`} className={buttonVariants({ size: "sm" })}>
                <PlusIcon /> New invoice
              </Link>
            )}
          </div>
          <CustomerInvoices customerId={c.id} />
        </section>
      </CardContent>
    </Card>
  );
}

const RECENT_INVOICES = 20;

async function CustomerInvoices({ customerId }: { customerId: number }) {
  const { count, items } = await searchInvoices({ query: "", status: "all", customerId }, RECENT_INVOICES);
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No invoices yet. Payments will show here too once they are built.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {items.map((inv) => (
          <li key={inv.id}>
            <Link
              href={`/invoices/${inv.id}`}
              className={`flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/60 ${inv.status === "cancelled" ? "opacity-60" : ""}`}
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs">{inv.number}</span>
                <span className="text-muted-foreground"> · {formatDate(inv.date)}</span>
                {inv.status === "cancelled" ? (
                  <Badge variant="destructive" className="ml-2">
                    cancelled
                  </Badge>
                ) : (
                  inv.paymentType === "cash" && (
                    <Badge variant="secondary" className="ml-2">
                      cash
                    </Badge>
                  )
                )}
              </span>
              <span className={`tabular-nums ${inv.status === "cancelled" ? "line-through" : ""}`}>
                {formatMoney(inv.grandTotal)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {count > items.length && (
        <p className="text-xs text-muted-foreground">Showing the latest {items.length} of {count}.</p>
      )}
    </div>
  );
}

export function CustomerPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-16" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
