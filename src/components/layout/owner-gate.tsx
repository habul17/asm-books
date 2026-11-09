import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { OwnerOnly } from "@/components/users/user-bits";
import { viewerIsOwner } from "@/server/auth";

async function Gate({ what, children }: { what: string; children: ReactNode }) {
  await connection();
  return (await viewerIsOwner()) ? children : <OwnerOnly what={what} />;
}

/** Shows its children to the owner only; staff see a short "ask the owner" note. */
export function OwnerGate({ what, fallback, children }: { what: string; fallback?: ReactNode; children: ReactNode }) {
  return (
    <Suspense fallback={fallback ?? null}>
      <Gate what={what}>{children}</Gate>
    </Suspense>
  );
}

async function ShowIf({ children }: { children: ReactNode }) {
  await connection();
  return (await viewerIsOwner()) ? children : null;
}

/** Renders its children only for the owner, and nothing for staff. */
export function OwnerOnlyBlock({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShowIf>{children}</ShowIf>
    </Suspense>
  );
}
