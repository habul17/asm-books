import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FieldRow, NewFieldForm } from "@/components/customers/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerOptions } from "@/server/customers";

export const metadata: Metadata = { title: "Customer fields" };

async function Fields() {
  const { fields } = await getCustomerOptions();
  return (
    <>
      <NewFieldForm />
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom fields yet.</p>
      ) : (
        <div className="flex flex-col divide-y border-t">
          {fields.map((f) => (
            <FieldRow key={f.id} field={f} />
          ))}
        </div>
      )}
    </>
  );
}

export default function CustomerFieldsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/customers" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom fields</CardTitle>
          <CardDescription>
            Add your own boxes to the customer form, such as vehicle type or area. Untick &quot;Shown&quot; to hide a
            field; values already saved are kept.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <Fields />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
