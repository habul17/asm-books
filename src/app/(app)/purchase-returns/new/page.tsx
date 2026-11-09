import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PurchaseReturnForm } from "@/components/purchase-returns/purchase-return-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getBillEditorOptions } from "@/server/bills";
import { todayInIndia } from "@/server/invoice-writes";
import { pickVendorById } from "@/server/vendors";

export const metadata: Metadata = { title: "New purchase return" };

async function Form({ searchParams }: { searchParams: PageProps<"/purchase-returns/new">["searchParams"] }) {
  await connection(); // Today's date must be read per request, not at build time.
  const raw = (await searchParams).vendor;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  const vendorId = Number.isSafeInteger(n) && n > 0 ? n : null;
  const [options, vendor] = await Promise.all([getBillEditorOptions(), vendorId ? pickVendorById(vendorId) : null]);
  return <PurchaseReturnForm today={todayInIndia()} vendor={vendor} sellerState={options.sellerState} />;
}

export default function NewPurchaseReturnPage({ searchParams }: PageProps<"/purchase-returns/new">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">New purchase return</h1>
        <p className="text-sm text-muted-foreground">
          For damaged or wrong parts going back to the vendor. You get a debit note to send with them.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
