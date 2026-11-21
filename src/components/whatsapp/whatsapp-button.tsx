"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeftIcon, ChevronRightIcon, MessageCircleIcon, PlusIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { addWhatsappTemplate, deleteWhatsappTemplate } from "@/app/(app)/customers/whatsapp-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { whatsappLink } from "@/lib/reminders/late-payments";
import {
  builtInTemplates,
  fillTemplate,
  MAX_BODY,
  MAX_TITLE,
  parseNewTemplate,
  PLACEHOLDERS,
  type ContactKind,
  type MessageTemplate,
} from "@/lib/whatsapp/templates";

type View = { at: "list" } | { at: "send"; text: string } | { at: "new" };

const rowClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 outline-none";

/**
 * The WhatsApp link beside a mobile number. It opens a list of ready-made and
 * saved messages; the chosen one can be changed before it opens in WhatsApp.
 */
export function WhatsAppButton({
  mobile,
  kind,
  name,
  balance,
  shop,
  templates: initial,
  look = "link",
}: {
  mobile: string | null;
  kind: ContactKind;
  name: string;
  /** "₹1,200.00" when the customer owes us; null otherwise. */
  balance: string | null;
  shop: string;
  templates: MessageTemplate[];
  look?: "link" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ at: "list" });
  const [mine, setMine] = useState(initial);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const plainChat = whatsappLink(mobile);
  if (!plainChat) return null;

  const fill = (t: string) => fillTemplate(t, { name, balance, shop });
  const ready = builtInTemplates(kind, balance != null);

  const reset = (o: boolean) => {
    setOpen(o);
    if (o) {
      setView({ at: "list" });
      setError(null);
      setConfirmDelete(null);
    }
  };

  const save = () => {
    const check = parseNewTemplate(title, body);
    if ("error" in check) return setError(check.error);
    start(async () => {
      const r = await addWhatsappTemplate(title, body);
      setMine(r.templates);
      if (r.error) return setError(r.error);
      setTitle("");
      setBody("");
      setError(null);
      setView({ at: "list" });
    });
  };

  const remove = (id: string) =>
    start(async () => {
      const r = await deleteWhatsappTemplate(id);
      setMine(r.templates);
      setConfirmDelete(null);
      setError(r.error ?? null);
    });

  const trigger =
    look === "button" ? (
      <Dialog.Trigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <MessageCircleIcon /> WhatsApp
      </Dialog.Trigger>
    ) : (
      <Dialog.Trigger className="flex items-center gap-1.5 hover:underline">
        <MessageCircleIcon className="size-3.5 text-muted-foreground" /> WhatsApp
      </Dialog.Trigger>
    );

  const row = (t: MessageTemplate, custom: boolean) => (
    <li key={t.id} className="flex items-center">
      <button type="button" className={rowClass} onClick={() => setView({ at: "send", text: fill(t.body) })}>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t.title}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{fill(t.body)}</span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {custom &&
        (confirmDelete === t.id ? (
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(t.id)}>
            Delete
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${t.title}`} onClick={() => setConfirmDelete(t.id)}>
            <Trash2Icon />
          </Button>
        ))}
    </li>
  );

  return (
    <Dialog.Root open={open} onOpenChange={reset}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <div className="flex items-center gap-2">
            {view.at !== "list" && (
              <Button size="icon-sm" variant="ghost" aria-label="Back" onClick={() => setView({ at: "list" })}>
                <ArrowLeftIcon />
              </Button>
            )}
            <Dialog.Title className="min-w-0 flex-1 truncate text-base font-semibold">
              {view.at === "new" ? "New template" : `WhatsApp ${name}`}
            </Dialog.Title>
            <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close">
              <XIcon />
            </Dialog.Close>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {view.at === "list" && (
            <>
              <section className="flex flex-col gap-1">
                <h3 className="px-1 text-xs font-medium text-muted-foreground">Templates</h3>
                <ul className="flex flex-col">{ready.map((t) => row(t, false))}</ul>
              </section>
              <section className="flex flex-col gap-1">
                <h3 className="px-1 text-xs font-medium text-muted-foreground">My templates</h3>
                {mine.length ? (
                  <ul className="flex flex-col">{mine.map((t) => row(t, true))}</ul>
                ) : (
                  <p className="px-1 text-sm text-muted-foreground">Messages you save appear here.</p>
                )}
              </section>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => setView({ at: "new" })}>
                  <PlusIcon /> New template
                </Button>
                <a
                  href={plainChat}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Open chat without a message
                </a>
              </div>
            </>
          )}

          {view.at === "send" && (
            <>
              <p className="text-sm text-muted-foreground">Check the message. You can change it before sending.</p>
              <Textarea
                aria-label="Message"
                value={view.text}
                maxLength={MAX_BODY * 2}
                onChange={(e) => setView({ at: "send", text: e.target.value })}
                className="min-h-40"
              />
              <a
                href={whatsappLink(mobile, view.text.trim()) ?? plainChat}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={buttonVariants()}
              >
                <SendIcon /> Send on WhatsApp
              </a>
            </>
          )}

          {view.at === "new" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Name
                <Input value={title} maxLength={MAX_TITLE} placeholder="e.g. Diwali wishes" onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Message
                <Textarea value={body} maxLength={MAX_BODY} className="min-h-32" onChange={(e) => setBody(e.target.value)} />
              </label>
              <p className="text-xs text-muted-foreground">
                Type {PLACEHOLDERS.join(", ")} and they are filled in for each person: their name, the shop&rsquo;s name, and
                what they owe.
              </p>
              <Button disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save template"}
              </Button>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
