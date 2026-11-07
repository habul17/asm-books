import type { Metadata } from "next";

import { ModuleList } from "@/components/layout/module-list";
import { MODULE_GROUPS } from "@/components/layout/modules";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">More Modules</h1>
      {MODULE_GROUPS.map((group) => (
        <ModuleList key={group.title ?? "top"} title={group.title} rows={group.modules} />
      ))}
    </div>
  );
}
