"use client";

import Link from "next/link";

import { addUser, changeMyPassword, saveUser, setUserPassword } from "@/app/(app)/users/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { PasswordInput } from "@/components/ui/password-input";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/user-validation";

const ROLE_HINTS: Record<Role, string> = {
  owner: "Everything, including users, backups and business settings.",
  staff: "Day-to-day work: invoices, payments, stock, bills and reports.",
};

function RoleChoice({ value, disabled }: { value?: Role; disabled?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Role</legend>
      {ROLES.map((r) => (
        <label key={r} className="flex items-start gap-2 text-sm">
          <input type="radio" name="role" value={r} defaultChecked={(value ?? "staff") === r} className="mt-0.5" />
          <span>
            <span className="font-medium">{ROLE_LABELS[r]}</span>{" "}
            <InfoTip label={`About ${ROLE_LABELS[r]}`}>{ROLE_HINTS[r]}</InfoTip>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function NewPasswordFields({ prefix, label = "Password" }: { prefix: string; label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={label} htmlFor={`${prefix}-pw`} hint={`At least ${PASSWORD_MIN} characters. A short sentence is easy to remember.`}>
        <PasswordInput id={`${prefix}-pw`} name="password" required minLength={PASSWORD_MIN} maxLength={200} autoComplete="new-password" />
      </Field>
      <Field label={`${label} again`} htmlFor={`${prefix}-pw2`}>
        <PasswordInput id={`${prefix}-pw2`} name="confirm" required minLength={PASSWORD_MIN} maxLength={200} autoComplete="new-password" />
      </Field>
    </div>
  );
}

export function NewUserForm() {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(addUser);
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="u-name">
          <Input id="u-name" name="name" required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Username" htmlFor="u-username" hint="Used to sign in. Letters, digits, dots or dashes.">
          <Input
            id="u-username"
            name="username"
            required
            minLength={3}
            maxLength={50}
            pattern="[a-zA-Z0-9._\-]{3,50}"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>
      <RoleChoice />
      <NewPasswordFields prefix="u" />
      <p className="text-sm text-muted-foreground">Tell them the password in person. Only the owner can change it later.</p>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Add user">
        <Link href="/users" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

export function EditUserForm({ user }: { user: { id: number; name: string; role: Role; active: boolean; isMe: boolean } }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveUser.bind(null, user.id));
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <Field label="Full name" htmlFor="e-name">
        <Input id="e-name" name="name" required maxLength={100} defaultValue={user.name} autoComplete="off" />
      </Field>
      {user.isMe && (
        <>
          {/* Disabled inputs are not sent, so keep your own role and access as they are. */}
          <input type="hidden" name="role" value={user.role} />
          <input type="hidden" name="active" value="on" />
        </>
      )}
      <RoleChoice value={user.role} disabled={user.isMe} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={user.isMe} className="mt-0.5" />
        <span>
          <span className="font-medium">Can sign in</span>{" "}
          {user.isMe ? (
            <span className="block text-muted-foreground">You cannot switch yourself off or change your own role.</span>
          ) : (
            <InfoTip label="About Can sign in">
              Untick to switch this person off. They are signed out at once. Their past work stays.
            </InfoTip>
          )}
        </span>
      </label>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Save changes" />
    </form>
  );
}

export function ResetPasswordForm({ userId, name }: { userId: number; name: string }) {
  const { state, pending, onSubmit, onChange, dirty, formRef } = useSaveForm(setUserPassword.bind(null, userId), {
    resetOnSuccess: true,
  });
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        For when {name} forgets their password. They are signed out on all devices and any lock from wrong tries is
        removed.
      </p>
      <NewPasswordFields prefix="r" label="New password" />
      <SaveRow state={state} pending={pending} dirty={dirty} label="Set new password" />
    </form>
  );
}

export function ChangePasswordForm() {
  const { state, pending, onSubmit, onChange, dirty, formRef } = useSaveForm(changeMyPassword, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-4">
      <Field label="Current password" htmlFor="c-current">
        <PasswordInput id="c-current" name="current" required maxLength={200} autoComplete="current-password" />
      </Field>
      <NewPasswordFields prefix="c" label="New password" />
      <p className="text-sm text-muted-foreground">You stay signed in here; other phones and computers are signed out.</p>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Change password" />
    </form>
  );
}
