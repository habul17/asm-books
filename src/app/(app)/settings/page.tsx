import type { Metadata } from "next";

import { TextSizePicker } from "@/components/layout/text-size";
import { ThemePicker } from "@/components/layout/theme-picker";
import { InfoTip } from "@/components/ui/info-tip";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          Settings{" "}
          <InfoTip label="About settings">These choices are saved on this phone or computer only.</InfoTip>
        </h1>
      </div>
      <TextSizePicker />
      <ThemePicker />
    </div>
  );
}
