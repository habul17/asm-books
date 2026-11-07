import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/invoices/invoice-actions";
import { CancelVendorPaymentForm } from "@/components/payments-made/cancel-vendor-payment-form";
import { PaymentVoucher } from "@/components/payments-made/payment-voucher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorBalance } from "@/components/vendors/vendor-balance";
import { getBusiness } from "@/server/settings";
import { getVendorPayment } from "@/server/vendor-payments";

export const metadata: Metadata = { title: "Payment made" };

async function Payment({ params }: { params: PageProps<"/payments-made/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [payment, business] = await Promise.all([getVendorPayment(id), getBusiness()]);
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
          <Link href={`/payments-made/${payment.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        <Link href={`/payments-made/new?vendor=${payment.vendorId}`} className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another payment
        </Link>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        <span>
          <Link href={`/vendors/${payment.vendorId}`} className="font-medium text-foreground hover:underline">
            {payment.vendorName}
          </Link>{" "}
          now: <VendorBalance amount={payment.balanceNow} />
        </span>
        {payment.createdByName && <span>Recorded by {payment.createdByName}</span>}
        {!final && payment.cancelReason && <span>Cancelled: {payment.cancelReason}</span>}
      </p>

      <PaymentVoucher payment={payment} business={business} />

      {final && <CancelVendorPaymentForm id={payment.id} />}
    </>
  );
}

export default function VendorPaymentPage({ params }: PageProps<"/payments-made/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/payments-made"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All payments made
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Payment params={params} />
      </Suspense>
    </div>
  );
}
