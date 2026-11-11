import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomFieldEntity } from "@/lib/custom-fields";
import { getCustomFields } from "@/server/custom-fields";

import { FieldRow, NewFieldForm } from "./field-forms";

async function Fields({ entity, placeholder }: { entity: CustomFieldEntity; placeholder: string }) {
  const fields = await getCustomFields(entity);
  return (
    <>
      <NewFieldForm entity={entity} placeholder={placeholder} />
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom fields yet.</p>
      ) : (
        <div className="flex flex-col divide-y border-t">
          {fields.map((f) => (
            <FieldRow key={f.id} entity={entity} field={f} />
          ))}
        </div>
      )}
    </>
  );
}

/** Add, rename and switch off the custom fields of one kind of record. */
export function CustomFieldsCard({
  entity,
  description,
  placeholder,
}: {
  entity: CustomFieldEntity;
  description: React.ReactNode;
  /** Example name shown in the "new field" box. */
  placeholder: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Custom fields</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-40" />}>
          <Fields entity={entity} placeholder={placeholder} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
