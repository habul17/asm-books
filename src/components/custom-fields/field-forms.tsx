"use client";

import { createField, updateField } from "@/app/(app)/custom-fields/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  FIELD_LABEL_MAX,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomFieldType,
} from "@/lib/custom-fields";

const TYPE_LABELS: Record<CustomFieldType, string> = { text: "Text", number: "Number", date: "Date" };

export function NewFieldForm({ entity, placeholder }: { entity: CustomFieldEntity; placeholder: string }) {
  const { state, pending, onSubmit, onChange, dirty, formRef } = useSaveForm(createField.bind(null, entity), {
    resetOnSuccess: true,
  });
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <Field label="New field name" htmlFor="f-new-label">
        <Input id="f-new-label" name="label" required maxLength={FIELD_LABEL_MAX} placeholder={placeholder} />
      </Field>
      <Field label="Type" htmlFor="f-new-type">
        <NativeSelect id="f-new-type" name="type" defaultValue="text" className="w-full">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Add field" />
    </form>
  );
}

export function FieldRow({ entity, field }: { entity: CustomFieldEntity; field: CustomFieldDef }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(updateField.bind(null, entity, field.id));
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="grid items-end gap-3 py-4 sm:grid-cols-[1fr_10rem_auto]">
      <Field label="Field name" htmlFor={`f-${field.id}-label`}>
        <Input
          id={`f-${field.id}-label`}
          name="label"
          defaultValue={field.label}
          required
          maxLength={FIELD_LABEL_MAX}
        />
      </Field>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Type</span>
        <span className="flex h-8 items-center text-muted-foreground">{TYPE_LABELS[field.type]}</span>
      </div>
      <SaveRow state={state} pending={pending} dirty={dirty}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={field.active} className="size-4 accent-primary" />
          Shown
        </label>
      </SaveRow>
    </form>
  );
}
