"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Starts its form again each time the screen is shown.
 *
 * The app keeps screens you leave alive in the background so going back is
 * instant. For a form that is wrong: boxes would still hold what was typed
 * last time (or the values from before the last save), and saving them would
 * undo a change. Layout effects run again whenever a kept screen is shown, so
 * this gives the form a new key then and it is rebuilt from the latest data.
 */
export function FreshOnShow({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const firstShow = useRef(true);
  useLayoutEffect(() => {
    if (firstShow.current) {
      firstShow.current = false;
      return;
    }
    setVersion((v) => v + 1);
  }, []);
  return <Fragment key={version}>{children}</Fragment>;
}
