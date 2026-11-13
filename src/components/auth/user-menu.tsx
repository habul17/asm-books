import { LogOutIcon } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";

/** Who is signed in on this device, with the Sign out button. Shown on the More screen. */
export async function SignedInAs() {
  const user = await requireUser();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-sm text-muted-foreground">
          {user.username} · {user.role === "owner" ? "Owner" : "Staff"}
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          <LogOutIcon />
          Sign out
        </Button>
      </form>
    </div>
  );
}
