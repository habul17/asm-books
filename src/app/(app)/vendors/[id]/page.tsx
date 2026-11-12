import { ArrowLeftIcon, CircleArrowUpIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BillList, BillListSkeleton } from "@/components/bills/bill-list";
import { PurchaseOrderList, PurchaseOrderListSkeleton } from "@/components/purchase-orders/purchase-order-list";
import { VendorPaymentList, VendorPaymentListSkeleton } from "@/components/payments-made/vendor-payment-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorBalance } from "@/components/vendors/vendor-balance";
import { formatMoney } from "@/lib/format";
import { getVendor } from "@/server/vendors";

export const metadata: Metadata = { title: "Vendor" };

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex flex-col gap-0.5 sm:col-span-2" : "flex flex-col gap-0.5"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm whitespace-pre-line">{children || "—"}</dd>
    </div>
  );
}

async function Vendor({ params }: { params: PageProps<"/vendors/[id]">["params"] }) {
  const id = Number((await params).id);
  const v = await getVendor(id);
  if (!v) notFound();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          {v.name}
          {!v.active && <Badge variant="outline">inactive</Badge>}
        </h1>
        <Link href={`/vendors/${v.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <PencilIcon /> Edit
        </Link>
        {v.active && (
          <Link href={`/purchase-orders/new?vendor=${v.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PlusIcon /> New order
          </Link>
        )}
        {v.active && (
          <Link href={`/bills/new?vendor=${v.id}`} className={buttonVariants({ size: "sm" })}>
            <PlusIcon /> New bill
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card p-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Balance</span>
          <VendorBalance amount={v.balance} className="text-lg font-semibold" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Payment terms</span>
          <span className="text-sm">{v.paymentTermsDays == null ? "—" : `${v.paymentTermsDays} days`}</span>
        </div>
        <Link href={`/payments-made/new?vendor=${v.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <CircleArrowUpIcon /> Pay vendor
        </Link>
        {(v.mobile || v.email) && (
          <div className="flex flex-wrap gap-2">
            {v.mobile && (
              <a href={`tel:${v.mobile}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <PhoneIcon /> {v.mobile}
              </a>
            )}
            {v.email && (
              <a href={`mailto:${v.email}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <MailIcon /> Email
              </a>
            )}
          </div>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label="Contact person">{v.contactPerson}</Fact>
        <Fact label="GSTIN">{v.gstin && <span className="font-mono">{v.gstin}</span>}</Fact>
        <Fact label="Address" wide>
          {[v.address, [v.city, v.pincode].filter(Boolean).join(" - ")].filter(Boolean).join("\n")}
        </Fact>
        <Fact label="State">{v.stateName && `${v.stateName} (${v.stateCode})`}</Fact>
        <Fact label="Opening balance">
          {v.openingBalance === 0 ? null : (
            <>
              {formatMoney(Math.abs(v.openingBalance))} {v.openingBalance > 0 ? "we owe" : "they owe us"}
            </>
          )}
        </Fact>
        {v.notes && (
          <Fact label="Notes" wide>
            {v.notes}
          </Fact>
        )}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Purchase orders</h2>
        <Suspense fallback={<PurchaseOrderListSkeleton />}>
          <PurchaseOrderList filters={{ query: "", status: "all", vendorId: v.id }} limit={50} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Bills</h2>
        <Suspense fallback={<BillListSkeleton />}>
          <BillList filters={{ query: "", status: "all", vendorId: v.id }} limit={50} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Payments made</h2>
        <Suspense fallback={<VendorPaymentListSkeleton />}>
          <VendorPaymentList filters={{ query: "", status: "all", vendorId: v.id }} limit={50} />
        </Suspense>
      </section>
    </>
  );
}

export default function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Link href="/vendors" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All vendors
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Vendor params={params} />
      </Suspense>
    </div>
  );
}
