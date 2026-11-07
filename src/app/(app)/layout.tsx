import { Suspense } from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { AppNav, NavLinks } from "@/components/layout/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 print:hidden z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6">
          <span className="shrink-0 font-semibold tracking-tight whitespace-nowrap">ASM Books</span>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <AppNav />
          </Suspense>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 print:p-0">{children}</main>
    </div>
  );
}
