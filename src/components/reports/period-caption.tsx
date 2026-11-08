import { formatDate } from "@/lib/format";
import type { Period } from "@/lib/reports/period";

/** "This month · 01-11-2026 to 08-11-2026" */
export function PeriodCaption({ period }: { period: Period }) {
  const range = period.from === period.to ? formatDate(period.from) : `${formatDate(period.from)} to ${formatDate(period.to)}`;
  return (
    <p className="text-sm font-medium" aria-live="polite">
      {period.preset === "custom" ? range : `${period.label} · ${range}`}
    </p>
  );
}
