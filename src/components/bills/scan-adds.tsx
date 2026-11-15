"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { addScannedPart, addScannedVendor } from "@/app/(app)/bills/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PickedVendor } from "@/server/vendors";

/** Shown when a scanned bill's supplier is not a saved vendor: adds them from what was read. */
export function AddScannedVendor({
  supplier,
  onAdded,
}: {
  supplier: { name: string | null; gstin: string | null };
  onAdded: (vendor: PickedVendor) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier.name ?? "");
  const [gstin, setGstin] = useState(supplier.gstin ?? "");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon /> {supplier.name ? `Add “${supplier.name}” as a new vendor` : "Add a new vendor"}
      </Button>
    );
  }

  const add = () =>
    startAdding(async () => {
      setError(null);
      const result = await addScannedVendor({ name, gstin });
      if (result.error !== undefined) setError(result.error);
      else onAdded(result.vendor);
    });

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">New vendor from the bill</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} aria-label="New vendor name" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          GSTIN (optional)
          <Input
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            maxLength={20}
            className="font-mono uppercase"
            aria-label="New vendor GSTIN"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Check the name and GSTIN against the bill. You can add the phone and address later in Vendors.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={adding} onClick={add}>
          {adding ? "Adding…" : "Add vendor"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export interface AddedPart {
  id: number;
  partNo: string;
  description: string;
  unit: string;
  gstRate: number;
}

/** Shown on a scanned row whose part is not in the list: adds it to the parts list from what was read. */
export function AddScannedPart({
  printedPartNo,
  description,
  hsn,
  unit,
  gstRate,
  onAdded,
}: {
  printedPartNo: string | null;
  description: string;
  hsn: string | null;
  unit: string;
  gstRate: number;
  onAdded: (part: AddedPart) => void;
}) {
  const [open, setOpen] = useState(false);
  const [partNo, setPartNo] = useState(printedPartNo ?? "");
  // An unmatched row's description starts with the printed part no; the part's own name is the rest.
  const printedName =
    printedPartNo && description.startsWith(`${printedPartNo} `) ? description.slice(printedPartNo.length + 1) : description;
  const [desc, setDesc] = useState(printedName === "Unreadable item" ? "" : printedName);
  const [code, setCode] = useState(hsn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <PlusIcon /> Add as a new part
      </Button>
    );
  }

  const add = () =>
    startAdding(async () => {
      setError(null);
      const result = await addScannedPart({ partNo, description: desc, hsn: code, unit, gstRate });
      if (result.error !== undefined) setError(result.error);
      else onAdded(result.item);
    });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-background p-3 text-foreground dark:border-amber-800">
      <p className="text-sm font-medium">New part from the bill · GST {gstRate}%</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Part no
          <Input
            value={partNo}
            onChange={(e) => setPartNo(e.target.value)}
            maxLength={60}
            className="font-mono"
            autoCapitalize="characters"
            aria-label="New part no"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Description
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} aria-label="New part description" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          HSN
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={10}
            inputMode="numeric"
            className="font-mono"
            aria-label="New part HSN"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Check the part no against the bill. The owner can add the category and selling price later in Parts.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={adding} onClick={add}>
          {adding ? "Adding…" : "Add part"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
