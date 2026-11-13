import type { Metadata } from "next";
import { Suspense } from "react";

import { BankForm } from "@/components/business/business-forms";
import { BusinessPage } from "@/components/business/business-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Bank and UPI" };

async function Form() {
  return <BankForm b={await getBusiness()} />;
}

export default function BankPage() {
  return (
    <BusinessPage title="Bank and UPI" note="Printed at the bottom of bills, so customers know where to pay.">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <Form />
      </Suspense>
    </BusinessPage>
  );
}
