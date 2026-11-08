import { LogOutIcon } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">{user.name}</span>
      <ThemeToggle />
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sign out" title="Sign out">
          <LogOutIcon />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
