import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Balance } from "@/components/customers/balance";
import { PrintButton } from "@/components/invoices/invoice-actions";
import { CancelPaymentForm } from "@/components/payments/cancel-payment-form";
import { PaymentReceipt } from "@/components/payments/payment-receipt";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { getPayment } from "@/server/payments";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Payment" };

async function Payment({ params }: { params: PageProps<"/payments/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [payment, business] = await Promise.all([getPayment(id), getBusiness()]);
  if (!payment) notFound();
  const final = payment.status === "final";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{payment.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <PrintButton />
        {final && (
          <Link href={`/payments/${payment.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        <Link href={`/payments/new?customer=${payment.customerId}`} className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another payment
        </Link>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        <span>
          <Link href={customersHref({ id: payment.customerId })} className="font-medium text-foreground hover:underline">
            {payment.customerName}
          </Link>{" "}
          now: <Balance amount={payment.balanceNow} />
        </span>
        {payment.createdByName && <span>Recorded by {payment.createdByName}</span>}
        {!final && payment.cancelReason && <span>Cancelled: {payment.cancelReason}</span>}
      </p>

      <PaymentReceipt payment={payment} business={business} />

      {final && <CancelPaymentForm id={payment.id} />}
    </>
  );
}

export default function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/payments"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All payments
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Payment params={params} />
      </Suspense>
    </div>
  );
}
