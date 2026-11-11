"use client";

import { createGroup, deleteGroup, updateGroup } from "@/app/(app)/customers/actions";
import { ConfirmDeleteButton } from "@/components/forms/confirm-button";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { GROUP_NAME_MAX } from "@/lib/customers/validation";

type PriceListOption = { id: number; name: string; enabled: boolean };

function PriceListSelect({
  id,
  lists,
  defaultValue,
}: {
  id: string;
  lists: PriceListOption[];
  defaultValue?: number | null;
}) {
  return (
    <NativeSelect id={id} name="priceListId" defaultValue={defaultValue ?? ""} className="w-full">
      <NativeSelectOption value="">— No price list —</NativeSelectOption>
      {lists.map((l) => (
        <NativeSelectOption key={l.id} value={l.id}>
          {l.name}
          {l.enabled ? "" : " (off)"}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function NewGroupForm({ lists }: { lists: PriceListOption[] }) {
  const { state, pending, onSubmit, onChange, dirty, formRef } = useSaveForm(createGroup, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Field label="New group name" htmlFor="g-new-name">
        <Input id="g-new-name" name="name" required maxLength={GROUP_NAME_MAX} placeholder="e.g. Garages" />
      </Field>
      <Field label="Default price list" htmlFor="g-new-list">
        <PriceListSelect id="g-new-list" lists={lists} />
      </Field>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Add group" />
    </form>
  );
}

export function GroupRow({
  group,
  lists,
}: {
  group: { id: number; name: string; priceListId: number | null; customerCount: number };
  lists: PriceListOption[];
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(updateGroup.bind(null, group.id));
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="grid items-end gap-3 py-4 sm:grid-cols-[1fr_1fr_auto]">
      <Field label="Group name" htmlFor={`g-${group.id}-name`}>
        <Input id={`g-${group.id}-name`} name="name" defaultValue={group.name} required maxLength={GROUP_NAME_MAX} />
      </Field>
      <Field label="Default price list" htmlFor={`g-${group.id}-list`}>
        <PriceListSelect id={`g-${group.id}-list`} lists={lists} defaultValue={group.priceListId} />
      </Field>
      <div className="flex flex-col gap-1">
        <SaveRow state={state} pending={pending} dirty={dirty}>
          {group.customerCount === 0 && (
            <ConfirmDeleteButton label="Delete" action={deleteGroup.bind(null, group.id)} />
          )}
        </SaveRow>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-3">
        {group.customerCount} customer{group.customerCount === 1 ? "" : "s"}
        {group.customerCount > 0 && " · move them to another group before deleting"}
      </p>
    </form>
  );
}
