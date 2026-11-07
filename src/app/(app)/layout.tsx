import Link from "next/link";
import { Suspense } from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { BottomTabs, BottomTabsView, Sidebar, SidebarLinks } from "@/components/layout/app-nav";

const Brand = () => (
  <Link href="/" className="shrink-0 font-semibold tracking-tight whitespace-nowrap">
    ASM Books
  </Link>
);

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-svh flex-col gap-6 overflow-y-auto border-r px-3 py-4 md:flex print:hidden">
        <div className="px-3">
          <Brand />
        </div>
        <Suspense fallback={<SidebarLinks pathname={null} />}>
          <Sidebar />
        </Suspense>
        <div className="mt-auto flex px-1">
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden print:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Brand />
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-4 pb-28 md:px-6 md:pb-6 print:p-0">
          {children}
        </main>
      </div>

      <Suspense fallback={<BottomTabsView pathname={null} />}>
        <BottomTabs />
      </Suspense>
    </div>
  );
}
