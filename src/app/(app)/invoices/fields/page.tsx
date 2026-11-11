import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CustomFieldsCard } from "@/components/custom-fields/fields-card";

export const metadata: Metadata = { title: "Invoice fields" };

export default function InvoiceFieldsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/invoices" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Invoices
      </Link>
      <CustomFieldsCard
        entity="invoice"
        placeholder="e.g. Vehicle number"
        description={
          <>
            Add your own boxes to the invoice, such as vehicle number or order number. What you fill in is printed on
            the invoice. Untick &quot;Shown&quot; to hide a field; values already saved are kept.
          </>
        }
      />
    </div>
  );
}
