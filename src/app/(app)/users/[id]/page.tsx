import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackTitle, formatDateTime, OwnerOnly } from "@/components/users/user-bits";
import { EditUserForm, ResetPasswordForm } from "@/components/users/user-forms";
import { ROLE_LABELS } from "@/lib/auth/user-validation";
import { getUser } from "@/server/users";

export const metadata: Metadata = { title: "User" };

async function User({ params }: { params: PageProps<"/users/[id]">["params"] }) {
  const user = await getUser(Number((await params).id));
  if (user === "forbidden") return <OwnerOnly what="manage users" />;
  if (!user) notFound();
  const locked = user.lockedUntil && user.lockedUntil > new Date();
  return (
    <>
      <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-sm">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {user.name}
          <Badge variant={user.role === "owner" ? "default" : "secondary"}>{ROLE_LABELS[user.role]}</Badge>
          {!user.active && <Badge variant="outline">switched off</Badge>}
          {locked && <Badge variant="destructive">locked</Badge>}
        </p>
        <p className="text-muted-foreground">
          Signs in as <span className="font-mono text-foreground">{user.username}</span>
        </p>
        <p className="text-muted-foreground">Last signed in {formatDateTime(user.lastLoginAt)}</p>
        {locked && (
          <p className="text-destructive">
            Locked after too many wrong passwords until {formatDateTime(user.lockedUntil)}. Setting a new password
            unlocks it.
          </p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditUserForm user={user} />
        </CardContent>
      </Card>
      {!user.isMe && (
        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm userId={user.id} name={user.name} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function UserPage({ params }: PageProps<"/users/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <BackTitle href="/users" label="Back to Users" title="User" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <User params={params} />
      </Suspense>
    </div>
  );
}
