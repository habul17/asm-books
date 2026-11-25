"use client";

import { useEffect } from "react";

/**
 * Scrolls to the section with this id when the address ends in #id. The section
 * streams in after the page opens, so the browser cannot find it by itself.
 */
export function ScrollHere({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
