import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessForm } from "@/components/settings/business-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth";
import { getBusiness, getPriceListOptions } from "@/server/settings";

export const metadata: Metadata = { title: "Business details" };

async function Business() {
  const [business, lists, user] = await Promise.all([getBusiness(), getPriceListOptions(), requireUser()]);
  return <BusinessForm business={business} priceLists={lists} canEdit={user.role === "owner"} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Business details</h1>
      <Card>
        <CardHeader>
          <CardTitle>Shop details, bill numbers and rules</CardTitle>
          <CardDescription>The same for everyone in the shop. Only the owner can change them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            }
          >
            <Business />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
