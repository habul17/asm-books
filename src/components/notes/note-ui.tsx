"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const popupClass =
  "min-w-52 rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";
const itemClass =
  "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none select-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export interface MenuEntry {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Shows a tick, for on/off choices. */
  checked?: boolean;
  /** A list that opens to the side. */
  items?: MenuEntry[];
}

function Entries({ entries }: { entries: (MenuEntry | "-")[] }) {
  return entries.map((e, i) =>
    e === "-" ? (
      <Menu.Separator key={i} className="mx-2 my-1 h-px bg-border" />
    ) : e.items ? (
      <Menu.SubmenuRoot key={i}>
        <Menu.SubmenuTrigger className={itemClass}>
          {e.icon}
          <span className="flex-1">{e.label}</span>
          <ChevronRightIcon />
        </Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner className="z-50" sideOffset={4} collisionPadding={12}>
            <Menu.Popup className={cn(popupClass, "max-h-80 overflow-y-auto")}>
              <Entries entries={e.items} />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    ) : (
      <Menu.Item
        key={i}
        disabled={e.disabled}
        onClick={e.onSelect}
        className={cn(itemClass, e.danger && "text-destructive [&_svg]:text-destructive")}
      >
        {e.icon}
        <span className="flex-1">{e.label}</span>
        {e.checked && <span aria-hidden>✓</span>}
      </Menu.Item>
    ),
  );
}

/** A "…" style menu. */
export function NoteMenu({
  trigger,
  label,
  entries,
  align = "end",
  className,
}: {
  trigger: ReactNode;
  label: string;
  entries: (MenuEntry | "-")[];
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-amber-600 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted dark:text-amber-400 [&_svg]:size-5",
          className,
        )}
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50" align={align} sideOffset={6} collisionPadding={12}>
          <Menu.Popup className={popupClass}>
            <Entries entries={entries} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A small centred box, like an iPhone alert. */
export function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl border bg-popover p-5 text-popover-foreground shadow-xl outline-none transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="text-center text-base font-semibold">{title}</Dialog.Title>
          {description && <Dialog.Description className="text-center text-sm text-muted-foreground">{description}</Dialog.Description>}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Asks before something that cannot be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <NoteDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            onOpenChange(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </NoteDialog>
  );
}

/** Asks for one line of text, such as a folder name. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  initial = "",
  placeholder,
  confirmLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel: string;
  /** Returns an error message to show, or nothing when done. */
  onSubmit: (value: string) => Promise<string | undefined>;
}) {
  return (
    <NoteDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {open && <PromptBody initial={initial} placeholder={placeholder} confirmLabel={confirmLabel} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />}
    </NoteDialog>
  );
}

function PromptBody({
  initial,
  placeholder,
  confirmLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (value: string) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await onSubmit(value);
        setBusy(false);
        if (err) setError(err);
      }}
    >
      <Input autoFocus value={value} placeholder={placeholder} maxLength={60} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !value.trim()}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
