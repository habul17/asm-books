import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FreshOnShow } from "@/components/forms/fresh-on-show";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorForm } from "@/components/vendors/vendor-form";
import { getVendor } from "@/server/vendors";

export const metadata: Metadata = { title: "Edit vendor" };

async function Form({ params }: { params: PageProps<"/vendors/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  const vendor = await getVendor(id);
  if (!vendor) notFound();
  return <VendorForm vendor={vendor} cancelHref={`/vendors/${vendor.id}`} />;
}

export default function EditVendorPage({ params }: PageProps<"/vendors/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit vendor</h1>
      <FreshOnShow>
        <Suspense fallback={<Skeleton className="h-[600px]" />}>
          <Form params={params} />
        </Suspense>
      </FreshOnShow>
    </div>
  );
}
