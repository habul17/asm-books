import { ChevronRightIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TextSizePicker } from "@/components/layout/text-size";
import { ThemePicker } from "@/components/layout/theme-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Display</h2>
          <p className="text-sm text-muted-foreground">Only for this phone or computer.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Text size</CardTitle>
          </CardHeader>
          <CardContent>
            <TextSizePicker />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Light or dark</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemePicker />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Business</h2>
          <p className="text-sm text-muted-foreground">The same for everyone in the shop.</p>
        </div>
        <Link href="/settings/business" className="rounded-xl hover:bg-muted/60">
          <Card className="bg-transparent">
            <CardHeader className="flex flex-row items-center gap-3">
              <StoreIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <CardTitle>Business details</CardTitle>
                <CardDescription>
                  Shop name and address, GSTIN, bill numbers, sales rules, reminders, opening balances, bank and UPI.
                </CardDescription>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </CardHeader>
          </Card>
        </Link>
      </section>
    </div>
  );
}
