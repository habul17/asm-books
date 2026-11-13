import type { Metadata } from "next";
import { Suspense } from "react";

import { NumbersForm } from "@/components/business/business-forms";
import { BusinessPage } from "@/components/business/business-page";
import { Skeleton } from "@/components/ui/skeleton";
import { financialYear } from "@/lib/invoices/math";
import { todayInIndia } from "@/server/invoice-writes";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Bill numbers" };

async function Form() {
  return <NumbersForm b={await getBusiness()} year={financialYear(todayInIndia())} />;
}

export default function NumbersPage() {
  return (
    <BusinessPage
      title="Bill numbers"
      note="The letters at the start of each number. Numbers start again from 0001 every April. Change these only before you start billing."
    >
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Form />
      </Suspense>
    </BusinessPage>
  );
}
