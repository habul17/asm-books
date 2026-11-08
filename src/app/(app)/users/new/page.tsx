import type { Metadata } from "next";
import { Suspense } from "react";

import { BackTitle, OwnerOnly } from "@/components/users/user-bits";
import { NewUserForm } from "@/components/users/user-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { isOwner, requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Add user" };

async function Body() {
  const me = await requireUser();
  return isOwner(me) ? <NewUserForm /> : <OwnerOnly what="add users" />;
}

export default function NewUserPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <BackTitle href="/users" label="Back to Users" title="Add user" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Body />
      </Suspense>
    </div>
  );
}
