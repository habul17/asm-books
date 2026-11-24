import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, OwnerOnly } from "@/components/users/user-bits";
import { isOwner, requireUser } from "@/server/auth";
import { loadBackupInfo } from "@/server/backup";

export const metadata: Metadata = { title: "Backups" };

async function Body() {
  await connection();
  const me = await requireUser();
  if (!isOwner(me)) return <OwnerOnly what="take backups" />;
  const info = await loadBackupInfo();
  const last = info.lastDownloadAt ? new Date(info.lastDownloadAt) : null;
  const stale = info.stale;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Download a copy</CardTitle>
          <CardDescription>
            All your items, prices, customers, invoices, payments, bills, expenses and stock in one file. Keep it on
            your computer or Google Drive. Passwords are not included.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className={stale ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {last
              ? `Last downloaded ${formatDateTime(last)}${info.lastDownloadBy ? ` by ${info.lastDownloadBy}` : ""}.`
              : "Never downloaded yet."}
            {stale && " Download one at least once a week."}
          </p>
          <a href="/backup/download" download className={buttonVariants({ className: "self-start" })}>
            <DownloadIcon /> Download backup
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Automatic nightly backup</CardTitle>
          <CardDescription>
            Every night at 2 am a full, password-protected copy is saved to your Google Drive, in the folder ASM Books backups. The newest 7 are kept; older ones are deleted so Drive does not fill up.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {info.lastAutoAt ? (
            <p className={info.autoLate ? "text-destructive" : "text-muted-foreground"}>
              Last nightly backup {formatDateTime(new Date(info.lastAutoAt))}.
              {info.autoLate && " It has stopped running. Tell your developer."}
            </p>
          ) : (
            <p className="text-muted-foreground">Not set up yet. Your developer connects it to your Google Drive once.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Other safety nets</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Full backup on your computer.</span> In the asm-books folder,
            run <code className="rounded bg-muted px-1 font-mono text-foreground">pnpm backup</code>. It saves a complete
            copy that can be restored exactly, in Documents › ASM Books backups.
          </p>
          <p>
            <span className="font-medium text-foreground">Database history.</span> The database (Neon) can also roll
            back to an earlier moment within its short free-plan history window, from the Neon website.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

export default function BackupPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-xl font-semibold max-md:sr-only">Backups</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <Body />
      </Suspense>
    </div>
  );
}
