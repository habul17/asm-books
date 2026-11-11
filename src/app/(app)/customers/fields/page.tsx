import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CustomFieldsCard } from "@/components/custom-fields/fields-card";

export const metadata: Metadata = { title: "Customer fields" };

export default function CustomerFieldsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/customers" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <CustomFieldsCard
        entity="customer"
        placeholder="e.g. Vehicle type"
        description={
          <>
            Add your own boxes to the customer form, such as vehicle type or area. Untick &quot;Shown&quot; to hide a
            field; values already saved are kept.
          </>
        }
      />
    </div>
  );
}
