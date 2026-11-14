"use client";

import Link from "next/link";
import { useState } from "react";

import { saveProduct } from "@/app/(app)/catalogue/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CATEGORY_NAME_MAX, DESCRIPTION_MAX, NEW_CATEGORY, PART_NO_MAX } from "@/lib/catalogue/product-validation";
import { GST_RATES } from "@/lib/settings/business";
import type { ProductDetail, ProductFormOptions } from "@/server/catalogue";

export function ProductForm({
  product,
  options,
  defaultGstRate,
  cancelHref,
}: {
  product: ProductDetail | null;
  options: ProductFormOptions;
  defaultGstRate: number;
  cancelHref: string;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveProduct.bind(null, product?.id ?? null));
  const p = product;
  const [category, setCategory] = useState(String(p?.categoryId ?? ""));

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">The part</legend>
        <Field label="Part no *" htmlFor="p-part" hint="The number printed on the part or box. Two parts cannot have the same number.">
          <Input
            id="p-part"
            name="partNo"
            defaultValue={p?.partNo}
            required
            maxLength={PART_NO_MAX}
            autoFocus={!p}
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <Field label="Brand" htmlFor="p-brand" hint="Pick one from the list, or type a new brand name.">
          <Input id="p-brand" name="brand" list="p-brands" defaultValue={p?.brand ?? ""} maxLength={100} autoComplete="off" />
          <datalist id="p-brands">
            {options.brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Description *" htmlFor="p-desc" className="sm:col-span-2" hint="The name printed on bills, like “Side mirror LH Swift”.">
          <Input id="p-desc" name="description" defaultValue={p?.description} required maxLength={DESCRIPTION_MAX} />
        </Field>
        <Field label="Category" htmlFor="p-cat" className="sm:col-span-2" hint="Helps you find the part when you search.">
          <NativeSelect
            id="p-cat"
            name="categoryId"
            className="w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            <NativeSelectOption value={NEW_CATEGORY}>+ New category…</NativeSelectOption>
            {options.categoryGroups.map((g) =>
              g.children.length ? (
                <optgroup key={g.id} label={g.name}>
                  {g.children.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </optgroup>
              ) : (
                <NativeSelectOption key={g.id} value={g.id}>
                  {g.name}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </Field>
        {category === NEW_CATEGORY && (
          <>
            <Field
              label="Main group *"
              htmlFor="p-newgroup"
              hint="The big heading the new category sits under. Pick one from the list, or type a new one."
            >
              <Input
                id="p-newgroup"
                name="newGroup"
                list="p-groups"
                maxLength={CATEGORY_NAME_MAX}
                autoComplete="off"
                autoCapitalize="characters"
                className="uppercase"
              />
              <datalist id="p-groups">
                {options.categoryGroups.map((g) => (
                  <option key={g.id} value={g.name} />
                ))}
              </datalist>
            </Field>
            <Field label="New category name *" htmlFor="p-newcat" hint="Like OIL SEALS. It is saved in capitals, like the rest of the list.">
              <Input
                id="p-newcat"
                name="newCategory"
                maxLength={CATEGORY_NAME_MAX}
                autoComplete="off"
                autoCapitalize="characters"
                className="uppercase"
              />
            </Field>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Tax</legend>
        <Field label="HSN code" htmlFor="p-hsn" hint="The tax code from the supplier's bill, like 8708. It prints on your bills.">
          <Input id="p-hsn" name="hsn" inputMode="numeric" defaultValue={p?.hsn ?? ""} maxLength={10} className="font-mono" />
        </Field>
        <Field label="GST %" htmlFor="p-gst" hint="Leave it on “Default” to use the GST % from Business details.">
          <NativeSelect id="p-gst" name="gstRate" className="w-full" defaultValue={p?.gstRate ?? ""}>
            <NativeSelectOption value="">Default ({defaultGstRate}%)</NativeSelectOption>
            {GST_RATES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r}%
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Unit" htmlFor="p-unit" hint="How you count it: Nos for pieces, or Set, Mtr, Ltr…">
          <Input id="p-unit" name="unit" list="p-units" defaultValue={p?.unit ?? "Nos"} maxLength={20} autoComplete="off" />
          <datalist id="p-units">
            {options.units.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Price and stock</legend>
        <Field
          label="Purchase price (₹)"
          htmlFor="p-cost"
          hint="What you pay the supplier for one. Price lists work out selling prices from it. Purchase bills update it by themselves."
        >
          <Input
            id="p-cost"
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={p?.purchasePrice ?? ""}
            placeholder="0.00"
          />
          {p && <input type="hidden" name="purchasePriceWas" value={p.purchasePrice ?? ""} />}
        </Field>
        <Field
          label="MRP / list price (₹)"
          htmlFor="p-list"
          hint="Optional. Used only by price lists that start from MRP, and on bills with no price list."
        >
          <Input id="p-list" name="listPrice" inputMode="decimal" defaultValue={p?.listPrice ?? ""} placeholder="0.00" />
        </Field>
        <Field label="Min stock" htmlFor="p-min" hint="When stock falls to this number, the part shows on the Low stock report. Leave it empty for no warning.">
          <Input id="p-min" name="minStock" inputMode="decimal" defaultValue={p?.minStock ?? ""} placeholder="e.g. 2" />
        </Field>
      </fieldset>

      {!p && (
        <p className="text-sm text-muted-foreground">
          A new part starts with 0 in stock. Stock goes up when you enter a purchase bill.
        </p>
      )}

      {p && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={p.active} className="mt-0.5 size-4 accent-primary" />
          <span>
            Switched on{" "}
            <InfoTip label="About Switched on">
              Untick to stop selling this part. It is hidden from bills and from staff searches. Old bills keep it, and you can switch it on again.
            </InfoTip>
          </span>
        </label>
      )}

      <SaveRow state={state} pending={pending} dirty={dirty} label={p ? "Save changes" : "Add part"}>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}
