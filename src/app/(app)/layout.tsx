import Link from "next/link";
import { Suspense } from "react";

import { BottomTabs, BottomTabsView, Sidebar, SidebarLinks } from "@/components/layout/app-nav";
import { ReminderBell, ReminderBellView } from "@/components/layout/reminder-bell";
import { viewerIsOwner } from "@/server/auth";

const Brand = () => (
  <Link href="/" aria-label="Home" className="shrink-0">
    {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 32px icon; no resizing needed */}
    <img src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-lg ring-1 ring-border" />
  </Link>
);

/** The side menu, without owner-only screens for staff. */
async function SidebarForViewer() {
  return <Sidebar isOwner={await viewerIsOwner()} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-svh flex-col gap-6 overflow-x-hidden overflow-y-auto border-r px-3 py-4 md:flex print:hidden">
        <div className="flex items-center justify-between gap-2 pr-1 pl-3">
          <Brand />
          <Suspense fallback={<ReminderBellView count={0} />}>
            <ReminderBell />
          </Suspense>
        </div>
        <Suspense fallback={<SidebarLinks pathname={null} isOwner={false} />}>
          <SidebarForViewer />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden print:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Brand />
            <div className="ml-auto flex items-center gap-1">
              <Suspense fallback={<ReminderBellView count={0} />}>
                <ReminderBell />
              </Suspense>
            </div>
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
