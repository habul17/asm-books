"use client";

import { CameraIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { removePartPhoto, savePartPhoto, type PhotoState } from "@/app/(app)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { shrinkImage } from "@/lib/bills/shrink-image";
import { PART_PHOTO_MAX_BYTES, PART_PHOTO_MAX_SIDE } from "@/lib/catalogue/part-photo";

import { PartPhoto } from "./part-photo";

const LIST_SHOWN = 8;

/**
 * The owner adds, changes or removes a part's photo. A phone opens its camera or
 * gallery; the photo is made small in the browser before it is sent. Related parts
 * (other colours or sizes) without a photo can share it in the same step.
 */
export function PartPhotoEditor({
  productId,
  partNo,
  photo,
  related,
}: {
  productId: number;
  partNo: string;
  photo: string | null;
  related: { id: number; partNo: string }[];
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [state, setState] = useState<PhotoState>({});
  const [share, setShare] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const upload = (picked: File | undefined) => {
    if (!picked) return;
    start(async () => {
      setState({});
      const file = await shrinkImage(picked, PART_PHOTO_MAX_BYTES, PART_PHOTO_MAX_SIDE);
      const form = new FormData();
      form.set("photo", file);
      if (share) for (const r of related) form.append("related", String(r.id));
      setState(await savePartPhoto(productId, form));
      if (input.current) input.current.value = "";
    });
  };

  const remove = () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    start(async () => setState(await removePartPhoto(productId)));
  };

  const names = related.slice(0, LIST_SHOWN).map((r) => r.partNo).join(", ");
  const more = related.length > LIST_SHOWN ? ` and ${related.length - LIST_SHOWN} more` : "";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <PartPhoto photo={photo} size="lg" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="font-medium">Photo</h2>
            <p className="text-sm text-muted-foreground">
              {photo ? `The photo shown for ${partNo} everywhere in the app.` : `${partNo} has no photo yet.`}
            </p>
          </div>
          {related.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                Also use it for {related.length === 1 ? "this related part" : `these ${related.length} related parts`} with
                no photo: <span className="font-mono">{names}</span>
                {more}
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              id={inputId}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={pending}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <Button type="button" size="sm" disabled={pending} onClick={() => input.current?.click()}>
              <CameraIcon /> {pending ? "Saving…" : photo ? "Change photo" : "Add photo"}
            </Button>
            {photo && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={remove}>
                <Trash2Icon /> {armed ? "Tap again to remove" : "Remove"}
              </Button>
            )}
          </div>
          <p aria-live="polite" className="text-sm">
            {state.error ? (
              <span className="text-destructive">{state.error}</span>
            ) : state.ok && !pending ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Saved ✓{state.shared ? ` Also added to ${state.shared} related part${state.shared === 1 ? "" : "s"}.` : ""}
              </span>
            ) : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
