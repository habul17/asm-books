"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";

/**
 * Loads the page's figures again. An app saved to the iPhone home screen has no
 * reload button or pull-to-refresh, so this is the way to see the latest data.
 * It keeps anything typed into a form that is not saved yet.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title="Refresh"
      aria-label={pending ? "Refreshing" : "Refresh"}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
    </button>
  );
}
