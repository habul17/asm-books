import type { Metadata } from "next";

import { TextSizePicker } from "@/components/layout/text-size";
import { ThemePicker } from "@/components/layout/theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">These are remembered on this phone or computer only.</p>
      </div>
      <TextSizePicker />
      <ThemePicker />
    </div>
  );
}
