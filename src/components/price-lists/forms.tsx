"use client";

import { useState } from "react";

import { updateFolder, updatePriceList } from "@/app/(app)/price-lists/actions";
import { Field, SaveRow, useSaveForm, useSelectOnMount } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { flattenFolders, type FolderNode } from "@/lib/price-lists/folders";
import {
  ADJUST_MAX,
  NAME_MAX,
  NOTES_MAX,
  ROUND_MAX,
  ROUNDING_OPTIONS,
} from "@/lib/price-lists/validation";
import { PRICE_BASES, type AdjustType, type PriceBase } from "@/lib/pricing";

function FolderOptions({ folders, excludeId }: { folders: FolderNode[]; excludeId?: number }) {
  // A folder cannot be moved into itself or its own subfolders.
  const hidden = new Set<number>();
  return (
    <>
      <NativeSelectOption value="">(Top level)</NativeSelectOption>
      {flattenFolders(folders).map((f) => {
        if (f.id === excludeId || (f.parentId != null && hidden.has(f.parentId))) {
          hidden.add(f.id);
          return null;
        }
        return (
          <NativeSelectOption key={f.id} value={f.id}>
            {"  ".repeat(f.depth) + f.name}
          </NativeSelectOption>
        );
      })}
    </>
  );
}

export function FolderForm({
  folder,
  folders,
  rename,
}: {
  folder: FolderNode;
  folders: FolderNode[];
  rename: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(updateFolder.bind(null, folder.id));
  const nameRef = useSelectOnMount(rename);

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="grid gap-4 sm:grid-cols-2">
      <Field label="Folder name" htmlFor="folder-name">
        <Input id="folder-name" ref={nameRef} name="name" defaultValue={folder.name} required maxLength={NAME_MAX} />
      </Field>
      <Field label="Inside folder" htmlFor="folder-parent">
        <NativeSelect id="folder-parent" name="parentId" defaultValue={folder.parentId ?? ""} className="w-full">
          <FolderOptions folders={folders} excludeId={folder.id} />
        </NativeSelect>
      </Field>
      <div className="sm:col-span-2">
        <SaveRow state={state} pending={pending} dirty={dirty} />
      </div>
    </form>
  );
}

export interface EditablePriceList {
  id: number;
  name: string;
  folderId: number | null;
  base: PriceBase;
  adjustType: AdjustType;
  adjustPct: number;
  discountPct: number;
  roundTo: number;
  enabled: boolean;
  notes: string | null;
}

export function PriceListForm({
  list,
  folders,
  rename,
}: {
  list: EditablePriceList;
  folders: FolderNode[];
  rename: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(updatePriceList.bind(null, list.id));
  const nameRef = useSelectOnMount(rename);
  const [base, setBase] = useState(list.base);
  const manualOnly = base === "manual";
  // Keep a non-standard rounding value (e.g. set in the database) selectable.
  const rounding = ROUNDING_OPTIONS.some((o) => o.value === list.roundTo)
    ? ROUNDING_OPTIONS
    : [...ROUNDING_OPTIONS, { value: list.roundTo, label: `Nearest ₹${list.roundTo}` }];

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="list-name" className="sm:col-span-2">
        <Input id="list-name" ref={nameRef} name="name" defaultValue={list.name} required maxLength={NAME_MAX} />
      </Field>
      <Field label="Folder" htmlFor="list-folder">
        <NativeSelect id="list-folder" name="folderId" defaultValue={list.folderId ?? ""} className="w-full">
          <FolderOptions folders={folders} />
        </NativeSelect>
      </Field>
      <Field label="Base price" htmlFor="list-base">
        <NativeSelect
          id="list-base"
          name="base"
          value={base}
          onChange={(e) => setBase(e.target.value as PriceBase)}
          className="w-full"
        >
          {Object.entries(PRICE_BASES).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <fieldset disabled={manualOnly} className="contents">
        <Field label="Type" htmlFor="list-type">
          <NativeSelect id="list-type" name="adjustType" defaultValue={list.adjustType} className="w-full">
            <NativeSelectOption value="markup">Markup (+)</NativeSelectOption>
            <NativeSelectOption value="markdown">Markdown (−)</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Markup / markdown %" htmlFor="list-adjust">
          <Input
            id="list-adjust"
            name="adjustPct"
            type="number"
            inputMode="decimal"
            min={0}
            max={ADJUST_MAX}
            step="any"
            defaultValue={list.adjustPct}
          />
        </Field>
        <Field label="Discount %" htmlFor="list-discount">
          <Input
            id="list-discount"
            name="discountPct"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="any"
            defaultValue={list.discountPct}
          />
        </Field>
        <Field label="Rounding" htmlFor="list-round">
          <NativeSelect id="list-round" name="roundTo" defaultValue={list.roundTo} className="w-full">
            {rounding
              .filter((o) => o.value <= ROUND_MAX)
              .map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
      </fieldset>
      {/* Disabled fields are not sent; keep the saved rule when "manual only" is chosen. */}
      {manualOnly && (
        <>
          <input type="hidden" name="adjustType" value={list.adjustType} />
          <input type="hidden" name="adjustPct" value={list.adjustPct} />
          <input type="hidden" name="discountPct" value={list.discountPct} />
          <input type="hidden" name="roundTo" value={list.roundTo} />
        </>
      )}
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="enabled" defaultChecked={list.enabled} className="mt-0.5 size-4 accent-primary" />
        <span>
          Switched on
          <span className="block text-muted-foreground">Shown in the catalogue and on invoices</span>
        </span>
      </label>
      <Field label="Notes" htmlFor="list-notes" className="sm:col-span-2">
        <Textarea id="list-notes" name="notes" rows={2} maxLength={NOTES_MAX} defaultValue={list.notes ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <SaveRow state={state} pending={pending} dirty={dirty} />
      </div>
    </form>
  );
}
