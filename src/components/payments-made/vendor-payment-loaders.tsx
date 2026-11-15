import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { moneyPrefill } from "@/lib/payments/prefill";
import { billScanReady } from "@/server/bill-scan";
import { todayInIndia } from "@/server/invoice-writes";
import { getVendorPayment } from "@/server/vendor-payments";
import { pickVendorById } from "@/server/vendors";

import { VendorPaymentForm } from "./vendor-payment-form";

export async function NewVendorPaymentForm({ vendorId, query = {} }: { vendorId: number | null; query?: Record<string, string | string[] | undefined> }) {
  await connection(); // Today's date must be read per request, not at build time.
  const vendor = vendorId ? await pickVendorById(vendorId) : null;
  const today = todayInIndia();
  const fill = moneyPrefill(query, today);
  return (
    <VendorPaymentForm
      id={null}
      initial={{ vendor, date: fill.date ?? today, amount: fill.amount, mode: fill.mode ?? "bank", reference: fill.reference, notes: fill.notes }}
      scanReady={billScanReady()}
      backHref={vendor ? `/vendors/${vendor.id}` : "/payments-made"}
    />
  );
}

export async function EditVendorPaymentForm({ id }: { id: number }) {
  const payment = await getVendorPayment(id);
  if (!payment || payment.status === "cancelled") notFound();
  const vendor = await pickVendorById(payment.vendorId);
  return (
    <VendorPaymentForm
      id={payment.id}
      initial={{
        vendor,
        date: payment.date,
        amount: payment.amount,
        mode: payment.mode,
        reference: payment.reference ?? "",
        notes: payment.notes ?? "",
      }}
      backHref={`/payments-made/${payment.id}`}
    />
  );
}

export function VendorPaymentFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-20" />
    </div>
  );
}
