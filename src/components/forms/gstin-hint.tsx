import { checkGstin, GST_STATES } from "@/lib/gst";

/** Live check of a GSTIN as it is typed. */
export function GstinHint({ value }: { value: string }) {
  const v = value.trim();
  if (!v) return null;
  if (v.replace(/\s/g, "").length < 15) return <p className="text-xs text-muted-foreground">15 characters</p>;
  const g = checkGstin(v);
  return g.ok ? (
    <p className="text-xs text-emerald-700 dark:text-emerald-400">Valid · {GST_STATES[g.stateCode]}</p>
  ) : (
    <p className="text-xs text-destructive">{g.error}</p>
  );
}
