import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessForm } from "@/components/settings/business-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth";
import { getBusiness, getPriceListOptions } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

async function Business() {
  const [business, lists, user] = await Promise.all([getBusiness(), getPriceListOptions(), requireUser()]);
  return <BusinessForm business={business} priceLists={lists} canEdit={user.role === "owner"} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>Printed on every invoice.</CardDescription>
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
