import { ArrowLeftIcon, ArrowRightIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/purchase-order-list";
import { PurchaseOrderStatusButtons } from "@/components/purchase-orders/purchase-order-status-buttons";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getPurchaseOrder } from "@/server/purchase-orders";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Purchase order" };

async function Order({ params }: { params: PageProps<"/purchase-orders/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [order, business] = await Promise.all([getPurchaseOrder(id), getBusiness()]);
  if (!order) notFound();
  const open = order.status === "open";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{order.number}</span>
          <PurchaseOrderStatusBadge status={order.status} />
        </h1>
        <PrintButton />
        {open && (
          <Link href={`/purchase-orders/${order.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        {open && (
          <Link href={`/bills/new?from=${order.id}`} className={buttonVariants({ size: "sm" })}>
            <ArrowRightIcon /> Enter bill
          </Link>
        )}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        <span>
          Vendor{" "}
          <Link href={`/vendors/${order.vendorId}`} className="font-medium text-foreground hover:underline">
            {order.vendorName}
          </Link>
        </span>
        {order.bills.map((b) => (
          <span key={b.id}>
            Bill{" "}
            <Link href={`/bills/${b.id}`} className="font-mono font-medium text-foreground hover:underline">
              {b.billNo}
            </Link>
            {b.status === "cancelled" && " (cancelled)"}
          </span>
        ))}
        {order.createdByName && <span>Made by {order.createdByName}</span>}
        <span>Does not change stock or what you owe the vendor</span>
      </p>

      <InvoiceDocument
        invoice={{ ...order, status: order.status === "cancelled" ? "cancelled" : "final" }}
        business={business}
        title="Purchase Order"
        numberLabel="Order No"
        user={order.createdByName}
        createdAt={order.createdAt}
        details={order.expectedDate ? [{ label: "Expected By", value: formatDate(order.expectedDate) }] : []}
        showBank={false}
      />

      <PurchaseOrderStatusButtons
        id={order.id}
        status={order.status}
        billed={order.bills.some((b) => b.status === "final")}
      />
    </>
  );
}

export default function PurchaseOrderPage({ params }: PageProps<"/purchase-orders/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/purchase-orders"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All purchase orders
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <Order params={params} />
      </Suspense>
    </div>
  );
}
