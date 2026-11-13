import type { Metadata } from "next";
import { Suspense } from "react";

import { SignedInAs } from "@/components/auth/user-menu";
import { ModuleList } from "@/components/layout/module-list";
import { moduleGroupsFor } from "@/components/layout/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { viewerIsOwner } from "@/server/auth";

export const metadata: Metadata = { title: "More" };

/** Every screen this person may use, grouped; staff do not see owner-only screens. */
async function Modules() {
  const groups = moduleGroupsFor(await viewerIsOwner());
  return groups.map((group) => <ModuleList key={group.title ?? "top"} title={group.title} rows={group.modules} />);
}

export default function MorePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">More</h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Modules />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Signed in as</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-10 rounded-lg" />}>
            <SignedInAs />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
