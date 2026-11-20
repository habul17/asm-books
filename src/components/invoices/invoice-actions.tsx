"use client";

import { PrinterIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { cancelInvoiceAction } from "@/app/(app)/invoices/actions";
import { CancelForm } from "@/components/forms/cancel-form";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <PrinterIcon /> Print / PDF
    </Button>
  );
}

type ShareState = "idle" | "making" | "ready" | "error";

/**
 * Makes a real PDF of the invoice on the server and opens the phone's share
 * sheet (WhatsApp and the rest). Where files cannot be shared, it downloads.
 */
export function SharePdfButton({ id, number }: { id: number; number: string }) {
  const [state, setState] = useState<ShareState>("idle");
  const [file, setFile] = useState<File | null>(null);

  const share = async (pdf: File) => {
    if (navigator.canShare?.({ files: [pdf] })) {
      try {
        await navigator.share({ files: [pdf], title: `Invoice ${number}` });
        setState("idle");
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        // The phone allows sharing only straight after a tap; making the PDF can take longer.
        if (name === "NotAllowedError") setState("ready");
        else setState(name === "AbortError" ? "idle" : "error");
      }
      return;
    }
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = pdf.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setState("idle");
  };

  const onClick = async () => {
    if (state === "ready" && file) return share(file);
    setState("making");
    try {
      const response = await fetch(`/invoices/${id}/pdf`, { cache: "no-store" });
      if (!response.ok) throw new Error("PDF failed");
      const name = `${number.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
      const pdf = new File([await response.blob()], name, { type: "application/pdf" });
      setFile(pdf);
      await share(pdf);
    } catch {
      setState("error");
    }
  };

  return (
    <Button type="button" size="sm" variant={state === "ready" ? "default" : "outline"} disabled={state === "making"} onClick={onClick}>
      <Share2Icon />
      {state === "making"
        ? "Making PDF…"
        : state === "ready"
          ? "PDF ready, tap to share"
          : state === "error"
            ? "Failed, tap to retry"
            : "Share PDF"}
    </Button>
  );
}

export function CancelInvoiceForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelInvoiceAction.bind(null, id)}
      title="Cancel this invoice"
      explanation="The invoice stays in the list marked as cancelled, its number is kept, its stock goes back and it no longer counts in the customer's balance. This cannot be undone."
      button="Cancel invoice"
    />
  );
}
