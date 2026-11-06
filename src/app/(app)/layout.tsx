import { AppNav } from "@/components/layout/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4">
          <span className="font-semibold tracking-tight">ASM Books</span>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4">{children}</main>
    </div>
  );
}
