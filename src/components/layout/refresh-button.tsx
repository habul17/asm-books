"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";

/**
 * Reloads the whole page, like the browser's reload button. An app saved to the
 * iPhone home screen has no reload button or pull-to-refresh, so this is the way
 * to get the latest data and the newest version of the app. Anything typed into
 * a form that is not saved yet is lost, as with any reload.
 */
export function RefreshButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      title="Refresh"
      aria-label={pending ? "Refreshing" : "Refresh"}
      disabled={pending}
      onClick={() => {
        setPending(true);
        // If the reload is called off (an unsaved note asks first), stop spinning.
        setTimeout(() => setPending(false), 4000);
        window.location.reload();
      }}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
    </button>
  );
}
