import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { billScanReady } from "@/server/bill-scan";
import { customersHref } from "@/lib/customers/href";
import { pickCustomerById } from "@/server/invoices";
import { todayInIndia } from "@/server/invoice-writes";
import { getPayment } from "@/server/payments";
import { moneyPrefill } from "@/lib/payments/prefill";

import { PaymentForm } from "./payment-form";
import { staffEditLimit } from "@/lib/edit-window";

export async function NewPaymentForm({ customerId, query = {} }: { customerId: number | null; query?: Record<string, string | string[] | undefined> }) {
  await connection(); // Today's date must be read per request, not at build time.
  const customer = customerId ? await pickCustomerById(customerId) : null;
  const today = todayInIndia();
  const fill = moneyPrefill(query, today);
  return (
    <PaymentForm
      id={null}
      initial={{ customer, date: fill.date ?? today, amount: fill.amount, mode: fill.mode ?? "cash", reference: fill.reference, notes: fill.notes }}
      scanReady={billScanReady()}
      backHref={customer ? customersHref({ id: customer.id }) : "/payments"}
    />
  );
}

export async function EditPaymentForm({ id }: { id: number }) {
  const payment = await getPayment(id);
  if (!payment || payment.status === "cancelled") notFound();
  if (!payment.canChange) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {staffEditLimit("payments")}
      </p>
    );
  }
  const customer = await pickCustomerById(payment.customerId);
  return (
    <PaymentForm
      id={payment.id}
      initial={{
        customer,
        date: payment.date,
        amount: payment.amount,
        mode: payment.mode,
        reference: payment.reference ?? "",
        notes: payment.notes ?? "",
      }}
      backHref={`/payments/${payment.id}`}
    />
  );
}

export function PaymentFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-20" />
    </div>
  );
}
