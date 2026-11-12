"use client";

import { UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { uploadDocument } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { shrinkImage } from "@/lib/bills/shrink-image";
import {
  DOCUMENT_FOLDERS,
  DOCUMENT_MAX_BYTES,
  type DocumentFolder,
  type DocumentLink,
} from "@/lib/documents/documents";

/** Room left for the form fields that travel with the file. */
const UPLOAD_MAX_BYTES = DOCUMENT_MAX_BYTES - 100 * 1024;
const MAX_FILES = 20;

/**
 * Upload photos or PDFs, one after another. With `link` the files are attached
 * to that bill or expense; with `options` the user picks the folder first.
 */
export function DocumentUpload({
  folder: startFolder = "other",
  link = null,
  options = false,
  canHide = false,
  label = "Upload files",
}: {
  folder?: DocumentFolder;
  link?: DocumentLink;
  /** Show the folder picker (and "owner only" for the owner). */
  options?: boolean;
  canHide?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<DocumentFolder>(startFolder);
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const [busy, startUpload] = useTransition();

  const upload = (picked: File[]) => {
    if (!picked.length) return;
    setErrors([]);
    setDone(0);
    startUpload(async () => {
      const problems: string[] = [];
      if (picked.length > MAX_FILES) problems.push(`Only the first ${MAX_FILES} files were taken. Upload the rest next.`);
      const files = picked.slice(0, MAX_FILES);
      let saved = 0;
      for (const [i, original] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}…`);
        const file = await shrinkImage(original, UPLOAD_MAX_BYTES);
        if (file.size > UPLOAD_MAX_BYTES) {
          problems.push(`${original.name}: too big. Use a file under 4 MB.`);
          continue;
        }
        const form = new FormData();
        form.set("file", file);
        form.set("name", original.name);
        form.set("folder", folder);
        if (ownerOnly && canHide) form.set("ownerOnly", "on");
        if (link && "billId" in link) form.set("billId", String(link.billId));
        else if (link) form.set("expenseId", String(link.expenseId));
        try {
          const result = await uploadDocument(form);
          if (result.error) problems.push(`${original.name}: ${result.error}`);
          else saved += 1;
        } catch {
          problems.push(`${original.name}: could not upload. Check your internet and try again.`);
        }
      }
      setProgress(null);
      setDone(saved);
      setErrors(problems);
    });
  };

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        {options && (
          <NativeSelect
            aria-label="Folder for the new files"
            value={folder}
            disabled={busy}
            onChange={(e) => setFolder(e.target.value as DocumentFolder)}
          >
            {Object.entries(DOCUMENT_FOLDERS).map(([key, name]) => (
              <NativeSelectOption key={key} value={key}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <Button type="button" variant={options ? "default" : "outline"} size={options ? "default" : "sm"} disabled={busy} onClick={() => inputRef.current?.click()}>
          <UploadIcon /> {progress ?? label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            upload([...(e.target.files ?? [])]);
            e.target.value = ""; // Let the same file be chosen again.
          }}
        />
        {options && canHide && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ownerOnly}
              disabled={busy}
              onChange={(e) => setOwnerOnly(e.target.checked)}
              className="size-4 accent-primary"
            />
            Only the owner can see
          </label>
        )}
        <span aria-live="polite" className="text-sm text-emerald-600 dark:text-emerald-400">
          {!busy && done > 0 && `${done} file${done === 1 ? "" : "s"} saved ✓`}
        </span>
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
