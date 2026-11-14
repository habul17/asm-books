import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GroupRow, NewGroupForm } from "@/components/customers/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { getCustomerOptions } from "@/server/customers";

export const metadata: Metadata = { title: "Customer groups" };

async function Groups() {
  const { groups, priceLists } = await getCustomerOptions();
  return (
    <>
      <NewGroupForm lists={priceLists} />
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet.</p>
      ) : (
        <div className="flex flex-col divide-y border-t">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} lists={priceLists} />
          ))}
        </div>
      )}
    </>
  );
}

export default function CustomerGroupsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/customers" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Customer groups{" "}
            <InfoTip label="About customer groups">
              Group customers, such as Garages, Retail or Dealers. A group&apos;s price list is used for every customer in
              it, unless the customer has their own.
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <Groups />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
