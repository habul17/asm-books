import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { OwnerOnlyBlock } from "@/components/layout/owner-gate";
import { CancelPurchaseReturnForm } from "@/components/purchase-returns/cancel-purchase-return-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { getPurchaseReturn } from "@/server/purchase-returns";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Purchase return" };

async function PurchaseReturn({ params }: { params: PageProps<"/purchase-returns/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [pr, business] = await Promise.all([getPurchaseReturn(id), getBusiness()]);
  if (!pr) notFound();
  const final = pr.status === "final";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{pr.number}</span>
          {!final && <Badge variant="destructive">cancelled</Badge>}
        </h1>
        <PrintButton />
        <Link href="/purchase-returns/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Another return
        </Link>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        <span>Parts taken out of stock</span>
        <span>
          <Link href={`/vendors/${pr.vendorId}`} className="font-medium text-foreground hover:underline">
            {pr.vendorName}
          </Link>{" "}
          now: you owe {formatMoney(pr.balanceNow)}
        </span>
        {pr.createdByName && <span>Made by {pr.createdByName}</span>}
        {!final && pr.cancelReason && <span>Cancelled: {pr.cancelReason}</span>}
      </p>

      <InvoiceDocument
        invoice={pr}
        business={business}
        title="Debit Note"
        partyLabel="Returned to"
        details={
          <>
            {pr.billRef && <p>Against your bill {pr.billRef}</p>}
            <p>Reason: {pr.reason}</p>
          </>
        }
      />

      {final && (
        <OwnerOnlyBlock>
          <CancelPurchaseReturnForm id={pr.id} />
        </OwnerOnlyBlock>
      )}
    </>
  );
}

export default function PurchaseReturnPage({ params }: PageProps<"/purchase-returns/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Link
        href="/purchase-returns"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All purchase returns
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <PurchaseReturn params={params} />
      </Suspense>
    </div>
  );
}
