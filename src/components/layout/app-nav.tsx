"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const NAV_ITEMS = [
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/price-lists", label: "Price lists" },
  { href: "/settings", label: "Settings" },
] as const;

/** The menu links; `pathname` marks the current section (null while it is not known yet). */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname != null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-3",
              active && "bg-muted text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Reads the current URL, so render it inside <Suspense> with `<NavLinks pathname={null} />` as the fallback. */
export function AppNav() {
  return <NavLinks pathname={usePathname()} />;
}
