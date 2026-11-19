"use client";

import { LockIcon } from "lucide-react";
import { useState } from "react";

import { setNoteLockAction } from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { makeLock, openLock } from "@/lib/notes/lock";
import type { NoteLock } from "@/server/notes";

import { NoteDialog } from "./note-ui";

/** The screen a locked note shows until the password is typed. */
export function LockedScreen({ lock, onKey }: { lock: NonNullable<NoteLock>; onKey: (key: CryptoKey) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <LockIcon className="size-7 text-muted-foreground" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">This note is locked.</h2>
        <p className="text-sm text-muted-foreground">Enter the notes password to view it.</p>
      </div>
      <PasswordForm lock={lock} onKey={onKey} />
    </div>
  );
}

function PasswordForm({ lock, onKey, submitLabel = "View Note" }: { lock: NonNullable<NoteLock>; onKey: (key: CryptoKey) => void; submitLabel?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex w-full max-w-xs flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const key = await openLock(password, lock);
        setBusy(false);
        if (key) onKey(key);
        else setError(true);
      }}
    >
      <PasswordInput
        autoFocus
        value={password}
        autoComplete="off"
        placeholder="Password"
        aria-invalid={error}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(false);
        }}
      />
      {error && (
        <p className="text-sm text-destructive">
          Wrong password.{lock.hint ? ` Hint: ${lock.hint}` : ""}
        </p>
      )}
      <Button type="submit" disabled={busy || !password}>
        {busy ? "Checking…" : submitLabel}
      </Button>
    </form>
  );
}

/** Asks for the notes password before locking or unlocking from the menu. */
export function PasswordDialog({
  open,
  onOpenChange,
  lock,
  onKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lock: NonNullable<NoteLock>;
  onKey: (key: CryptoKey) => void;
}) {
  return (
    <NoteDialog open={open} onOpenChange={onOpenChange} title="Enter Password" description="Enter the password for your locked notes.">
      {open && (
        <PasswordForm
          lock={lock}
          submitLabel="OK"
          onKey={(k) => {
            onOpenChange(false);
            onKey(k);
          }}
        />
      )}
    </NoteDialog>
  );
}

/** Sets the one password used for all locked notes, the first time a note is locked. */
export function SetPasswordDialog({
  open,
  onOpenChange,
  onKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onKey: (key: CryptoKey) => void;
}) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <NoteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Set Password"
      description="This password locks all your notes. If you forget it, locked notes cannot be opened by anyone, not even the owner."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 6) return setError("Use at least 6 characters.");
          if (password !== again) return setError("The two passwords are different.");
          if (hint && hint.toLowerCase().includes(password.toLowerCase())) return setError("The hint must not contain the password.");
          setBusy(true);
          const made = await makeLock(password);
          const res = await setNoteLockAction({ salt: made.salt, iterations: made.iterations, check: made.check, hint });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          onOpenChange(false);
          onKey(made.key);
        }}
      >
        <PasswordInput autoFocus autoComplete="new-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordInput autoComplete="new-password" placeholder="Verify" value={again} onChange={(e) => setAgain(e.target.value)} />
        <Input
          placeholder="Hint (optional)"
          maxLength={100}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy ? "Setting…" : "Done"}
          </Button>
        </div>
      </form>
    </NoteDialog>
  );
}
