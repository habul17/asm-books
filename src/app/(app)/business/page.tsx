import { BanknoteIcon, ReceiptTextIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ModuleList } from "@/components/layout/module-list";
import { OwnerGate } from "@/components/layout/owner-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { getBusiness } from "@/server/settings";

export const metadata: Metadata = { title: "Business details" };

const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");

async function Parts() {
  const b = await getBusiness();
  return (
    <ModuleList
      rows={[
        {
          label: "Shop details",
          icon: StoreIcon,
          href: "/business/shop",
          note: join(b.name, b.city, b.gstin) || "Name, address, GSTIN, phone",
        },
        {
          label: "Bills",
          icon: ReceiptTextIcon,
          href: "/business/bills",
          note: join(b.invoiceTitle, `GST ${b.defaultGstRate}%`, `Numbers ${b.invoicePrefix}/…`),
        },
        {
          label: "Bank details",
          icon: BanknoteIcon,
          href: "/business/bank",
          note: join(b.bankName, b.bankBranch) || "Printed on bills so customers can pay",
        },
      ]}
    />
  );
}

export default function BusinessPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          Business details{" "}
          <InfoTip label="About business details">Your shop&apos;s details, printed on every bill. Only the owner can change them.</InfoTip>
        </h1>
      </div>
      <OwnerGate what="see business details" fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
          <Parts />
        </Suspense>
      </OwnerGate>
    </div>
  );
}
