import { HashIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BillsForm } from "@/components/business/business-forms";
import { BusinessPage } from "@/components/business/business-page";
import { ModuleList } from "@/components/layout/module-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusiness, getPriceListOptions } from "@/server/settings";

export const metadata: Metadata = { title: "Bills" };

async function Form() {
  const [b, lists] = await Promise.all([getBusiness(), getPriceListOptions()]);
  return <BillsForm b={b} priceLists={lists} />;
}

async function Numbers() {
  const b = await getBusiness();
  return (
    <ModuleList
      rows={[
        {
          label: "Bill numbers",
          icon: HashIcon,
          href: "/business/numbers",
          note: `${b.invoicePrefix}, ${b.receiptPrefix}, ${b.creditNotePrefix} and 8 more`,
        },
      ]}
    />
  );
}

export default function BillsPage() {
  return (
    <BusinessPage
      title="Bills"
      note="How invoices look and the rules for selling."
      after={
        <Suspense fallback={<Skeleton className="h-16 rounded-2xl" />}>
          <Numbers />
        </Suspense>
      }
    >
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Form />
      </Suspense>
    </BusinessPage>
  );
}
