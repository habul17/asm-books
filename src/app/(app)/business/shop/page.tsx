import type { Metadata } from "next";
import { Suspense } from "react";

import { ShopForm } from "@/components/business/business-forms";
import { BusinessPage } from "@/components/business/business-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Shop details" };

async function Form() {
  return <ShopForm b={await getBusiness()} />;
}

export default function ShopPage() {
  return (
    <BusinessPage title="Shop details" note="Printed at the top of every bill.">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Form />
      </Suspense>
    </BusinessPage>
  );
}
