import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FreshOnShow } from "@/components/forms/fresh-on-show";
import { ProductForm } from "@/components/catalogue/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getProduct, getProductFormOptions } from "@/server/catalogue";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Edit part" };

async function Form({ params }: { params: PageProps<"/catalogue/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  const [product, options, business] = await Promise.all([getProduct(id), getProductFormOptions(), getBusiness()]);
  if (!product) notFound();
  const back = `/catalogue?q=${encodeURIComponent(product.partNo)}&id=${product.id}`;
  if (!product.canEdit) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Only the owner can change a part. Please ask the owner.
      </p>
    );
  }
  return <ProductForm product={product} options={options} defaultGstRate={business.defaultGstRate} cancelHref={back} />;
}

export default function EditProductPage({ params }: PageProps<"/catalogue/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit part</h1>
      <FreshOnShow>
        <Suspense fallback={<Skeleton className="h-[560px]" />}>
          <Form params={params} />
        </Suspense>
      </FreshOnShow>
    </div>
  );
}
