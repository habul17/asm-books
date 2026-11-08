import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";

import { formatDateTime, OwnerOnly } from "@/components/users/user-bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS } from "@/lib/auth/user-validation";
import { listUsers } from "@/server/users";

export const metadata: Metadata = { title: "Users" };

async function Users() {
  const data = await listUsers();
  if (!data) return <OwnerOnly what="manage users" />;
  return (
    <>
      <div className="flex justify-end">
        <Link href="/users/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> Add user
        </Link>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border">
        {data.items.map((u) => (
          <li key={u.id}>
            <Link
              href={`/users/${u.id}`}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                !u.active && "opacity-60",
              )}
            >
              <span className="truncate font-medium">
                {u.name}
                {u.id === data.me.id && <span className="font-normal text-muted-foreground"> (you)</span>}
              </span>
              <span className="flex justify-end gap-1">
                {!u.active && <Badge variant="outline">switched off</Badge>}
                {u.lockedUntil && u.lockedUntil > new Date() && <Badge variant="destructive">locked</Badge>}
                <Badge variant={u.role === "owner" ? "default" : "secondary"}>{ROLE_LABELS[u.role]}</Badge>
              </span>
              <span className="col-span-2 truncate text-xs text-muted-foreground">
                <span className="font-mono">{u.username}</span> · last signed in {formatDateTime(u.lastLoginAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function UsersPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="-mt-2 text-sm text-muted-foreground">Who can sign in to ASM Books, and what they can do.</p>
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <Users />
      </Suspense>
    </div>
  );
}
