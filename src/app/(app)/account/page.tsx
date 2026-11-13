import type { Metadata } from "next";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/components/users/user-forms";
import { ROLE_LABELS } from "@/lib/auth/user-validation";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "My account" };

async function Me() {
  const me = await requireUser();
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-sm">
      <p className="flex items-center gap-2 text-base font-semibold">
        {me.name}
        <Badge variant={me.role === "owner" ? "default" : "secondary"}>{ROLE_LABELS[me.role]}</Badge>
      </p>
      <p className="text-muted-foreground">
        Signs in as <span className="font-mono text-foreground">{me.username}</span>
      </p>
    </div>
  );
}

/** The owner changes her own password here; staff passwords are set only by the owner. */
async function Password() {
  const me = await requireUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        {me.role === "owner" ? (
          <ChangePasswordForm />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only the owner can change passwords. If you need a new one, ask the owner.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-xl font-semibold">My account</h1>
      <Suspense fallback={<Skeleton className="h-20 rounded-xl" />}>
        <Me />
      </Suspense>
      <Suspense fallback={null}>
        <Password />
      </Suspense>
    </div>
  );
}
