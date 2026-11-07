import type { Metadata } from "next";

import { VendorForm } from "@/components/vendors/vendor-form";

export const metadata: Metadata = { title: "New vendor" };

export default function NewVendorPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">New vendor</h1>
      <VendorForm vendor={null} cancelHref="/vendors" />
    </div>
  );
}
