"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { isActive, isFormPage, MODULE_GROUPS, TAB_MODULES } from "./modules";

/** Pages reached from the "More" tab, so that tab lights up on them. */
const MORE_PATHS = ["/more", "/reminders", "/reports", "/settings", "/price-lists", "/payments", "/credit-notes", "/sales", "/eway-bills", "/vendors", "/purchase-orders", "/bills", "/payments-made", "/purchase-returns", "/expenses", "/inventory-adjustments", "/users", "/documents", "/backup", "/account"];

const sideLink =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";

/**
 * Desktop sidebar: the built modules, grouped. `pathname` marks the current
 * page (null while it is not known yet, e.g. as a Suspense fallback).
 */
export function SidebarLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {MODULE_GROUPS.map((group) => {
        const ready = group.modules.filter((m) => m.href != null);
        if (ready.length === 0) return null;
        return (
          <div key={group.title ?? "top"} className="flex flex-col gap-0.5">
            {group.title && (
              <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.title}
              </p>
            )}
            {ready.map((m) => {
              const active = isActive(pathname, m.href);
              return (
                <Link
                  key={m.label}
                  href={m.href!}
                  aria-current={active ? "page" : undefined}
                  className={cn(sideLink, active && "bg-muted text-foreground")}
                >
                  <m.icon className="size-4 shrink-0" aria-hidden />
                  {m.label}
                </Link>
              );
            })}
          </div>
        );
      })}
      <Link
        href="/more"
        aria-current={pathname === "/more" ? "page" : undefined}
        className={cn(sideLink, pathname === "/more" && "bg-muted text-foreground")}
      >
        <EllipsisIcon className="size-4 shrink-0" aria-hidden />
        All modules
      </Link>
    </nav>
  );
}

/** Reads the current URL, so render it inside <Suspense> with `<SidebarLinks pathname={null} />` as the fallback. */
export function Sidebar() {
  return <SidebarLinks pathname={usePathname()} />;
}

const TABS = [...TAB_MODULES, { label: "More", icon: EllipsisIcon, href: "/more" }];

/** Phone bottom tab bar, like a native app. Hidden on full-screen forms. */
export function BottomTabsView({ pathname }: { pathname: string | null }) {
  if (isFormPage(pathname)) return null;
  const moreActive = pathname != null && MORE_PATHS.some((p) => isActive(pathname, p));
  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-full border bg-background/90 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden print:hidden"
    >
      {TABS.map((t) => {
        const active = t.href === "/more" ? moreActive : isActive(pathname, t.href);
        return (
          <Link
            key={t.label}
            href={t.href!}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium text-muted-foreground transition-colors",
              active && "bg-muted text-foreground",
            )}
          >
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Reads the current URL, so render it inside <Suspense> with `<BottomTabsView pathname={null} />` as the fallback. */
export function BottomTabs() {
  return <BottomTabsView pathname={usePathname()} />;
}
