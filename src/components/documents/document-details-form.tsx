"use client";

import { saveDocumentDetails } from "@/app/(app)/documents/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_FOLDERS } from "@/lib/documents/documents";

export function DocumentDetailsForm({
  doc,
  canHide,
}: {
  doc: { id: number; title: string; folder: string; docDate: string | null; notes: string | null; ownerOnly: boolean };
  /** True for the owner, who decides whether staff can see the document. */
  canHide: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveDocumentDetails.bind(null, doc.id));
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="d-title">
        <Input id="d-title" name="title" required maxLength={150} defaultValue={doc.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Folder" htmlFor="d-folder">
          <NativeSelect id="d-folder" name="folder" defaultValue={doc.folder} className="w-full">
            {Object.entries(DOCUMENT_FOLDERS).map(([key, name]) => (
              <NativeSelectOption key={key} value={key}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date on the paper (optional)" htmlFor="d-date">
          <Input id="d-date" name="docDate" type="date" defaultValue={doc.docDate ?? ""} />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="d-notes" hint="Words here are found by the search.">
        <Textarea id="d-notes" name="notes" rows={2} maxLength={1000} defaultValue={doc.notes ?? ""} />
      </Field>
      {canHide && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="ownerOnly" defaultChecked={doc.ownerOnly} className="mt-0.5 size-4 accent-primary" />
          <span>
            <span className="font-medium">Only the owner can see this</span>
            <span className="block text-muted-foreground">Staff will not find it or be able to open it.</span>
          </span>
        </label>
      )}
      <SaveRow state={state} pending={pending} dirty={dirty} />
    </form>
  );
}
