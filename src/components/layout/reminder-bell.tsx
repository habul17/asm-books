import { BellIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";
import { getReminders } from "@/server/reminders";

/** The bell with the number of open reminders on it. */
export function ReminderBellView({ count }: { count: number }) {
  return (
    <Link
      href="/reminders"
      title="Reminders"
      aria-label={count > 0 ? `Reminders: ${count} to look at` : "Reminders"}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative shrink-0")}
    >
      <BellIcon />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Reads live data, so render it inside <Suspense>. A failed count never breaks the page. */
export async function ReminderBell() {
  let count = 0;
  try {
    count = (await getReminders()).count;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[reminders] count failed:", err instanceof Error ? err.message : err);
  }
  return <ReminderBellView count={count} />;
}
