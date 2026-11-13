import type { Metadata } from "next";
import { Suspense } from "react";

import { SignedInAs } from "@/components/auth/user-menu";
import { ModuleList } from "@/components/layout/module-list";
import { MODULE_GROUPS } from "@/components/layout/modules";
import { TextSizePicker } from "@/components/layout/text-size";
import { ThemePicker } from "@/components/layout/theme-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">More</h1>
      {MODULE_GROUPS.map((group) => (
        <ModuleList key={group.title ?? "top"} title={group.title} rows={group.modules} />
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Text size</CardTitle>
        </CardHeader>
        <CardContent>
          <TextSizePicker />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Light or dark</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>
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
