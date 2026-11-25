/** A date range for a report: from and to are inclusive ISO dates (YYYY-MM-DD). */
export interface Period {
  from: string;
  to: string;
  preset: PeriodPreset;
  label: string;
}

export type PeriodPreset = "today" | "this-month" | "last-month" | "last-6-months" | "this-fy" | "last-fy" | "custom";

export const PERIOD_PRESETS: { value: Exclude<PeriodPreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-fy", label: "This financial year" },
  { value: "last-fy", label: "Last financial year" },
];

/** The same, with the last 6 months: for screens that look at money over a longer stretch. */
export const PERIOD_PRESETS_WITH_6_MONTHS: typeof PERIOD_PRESETS = [
  ...PERIOD_PRESETS.slice(0, 3),
  { value: "last-6-months", label: "Last 6 months" },
  ...PERIOD_PRESETS.slice(3),
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** True for a real calendar date such as 2026-02-28 (not 2026-02-30). */
export function isIsoDate(s: string): boolean {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function monthEnd(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based, day 0 of next month
}

/** The dates a preset covers, as seen on `today`. */
export function presetRange(preset: Exclude<PeriodPreset, "custom">, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this-month":
      return { from: `${y}-${pad(m)}-01`, to: today };
    case "last-month": {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(monthEnd(ly, lm))}` };
    }
    case "last-6-months": {
      // This month and the five before it, as on the Home chart.
      const t = y * 12 + (m - 1) - 5;
      return { from: `${Math.floor(t / 12)}-${pad((t % 12) + 1)}-01`, to: today };
    }
    case "this-fy": {
      const start = m >= 4 ? y : y - 1;
      return { from: `${start}-04-01`, to: today };
    }
    case "last-fy": {
      const start = (m >= 4 ? y : y - 1) - 1;
      return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
    }
  }
}

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

/**
 * Read the period from the page's search params (?period=last-month, or ?from=&to=).
 * Anything missing or invalid falls back to this month.
 */
export function parsePeriod(
  params: { period?: string; from?: string; to?: string },
  today: string,
  presets: typeof PERIOD_PRESETS = PERIOD_PRESETS,
): Period {
  const from = params.from ?? "";
  const to = params.to ?? "";
  if (isIsoDate(from) && isIsoDate(to)) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return { from: a, to: b, preset: "custom", label: a === b ? formatDay(a) : `${formatDay(a)} to ${formatDay(b)}` };
  }
  const preset = presets.find((p) => p.value === params.period) ?? PERIOD_PRESETS[1];
  return { ...presetRange(preset.value, today), preset: preset.value, label: preset.label };
}

/** Query string that keeps a period when moving between reports. */
export function periodQuery(period: Period): string {
  if (period.preset === "custom") return `from=${period.from}&to=${period.to}`;
  return period.preset === "this-month" ? "" : `period=${period.preset}`;
}

/** Each calendar month a period touches, cut to the period: { month: "2026-11", from, to }, oldest first. */
export function periodMonths(from: string, to: string): { month: string; from: string; to: string }[] {
  const index = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const out: { month: string; from: string; to: string }[] = [];
  for (let i = index(from); i <= index(to); i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    const first = `${y}-${pad(m)}-01`;
    const last = `${y}-${pad(m)}-${pad(monthEnd(y, m))}`;
    out.push({ month: `${y}-${pad(m)}`, from: first < from ? from : first, to: last > to ? to : last });
  }
  return out;
}
