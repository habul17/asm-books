import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductForm } from "@/components/catalogue/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductFormOptions } from "@/server/catalogue";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Add part" };

async function Form() {
  const [options, business] = await Promise.all([getProductFormOptions(), getBusiness()]);
  return <ProductForm product={null} options={options} defaultGstRate={business.defaultGstRate} cancelHref="/catalogue" />;
}

export default function NewProductPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Add part</h1>
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <Form />
      </Suspense>
    </div>
  );
}
