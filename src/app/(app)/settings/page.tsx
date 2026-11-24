import type { Metadata } from "next";

import { TextSizePicker } from "@/components/layout/text-size";
import { ThemePicker } from "@/components/layout/theme-picker";
import { SectionTip } from "@/components/layout/section-tips";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1 max-md:sr-only">
        <h1 className="text-xl font-semibold">
          Settings{" "}
          <SectionTip href="/settings" />
        </h1>
      </div>
      <TextSizePicker />
      <ThemePicker />
    </div>
  );
}
