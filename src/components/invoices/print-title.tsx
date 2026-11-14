"use client";

import { useEffect } from "react";

/**
 * While printing, names the page after the document (e.g. INV-26-27-0001), so
 * "Save as PDF" suggests that file name instead of the app's page title.
 */
export function PrintTitle({ name }: { name: string }) {
  useEffect(() => {
    const fileName = name.replace(/[\\/:*?"<>|\s]+/g, "-");
    let saved = document.title;
    const before = () => {
      saved = document.title;
      document.title = fileName;
    };
    const after = () => {
      document.title = saved;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [name]);
  return null;
}
