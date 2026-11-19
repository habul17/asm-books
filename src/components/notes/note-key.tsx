"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** Locked notes close again after this long without a tap or key press. */
const IDLE_MS = 10 * 60 * 1000;

interface KeyState {
  /** The key for locked notes while they are open; never stored anywhere. */
  key: CryptoKey | null;
  setKey: (key: CryptoKey | null) => void;
}

const KeyContext = createContext<KeyState>({ key: null, setKey: () => {} });

/**
 * Holds the locked-notes key in memory only, for the Notes screens. It is
 * forgotten on "Lock Now", after 10 idle minutes, or when the page closes.
 */
export function NoteKeyProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKey(null), IDLE_MS);
  }, []);

  useEffect(() => {
    if (!key) return;
    arm();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [key, arm]);

  const value = useMemo(() => ({ key, setKey }), [key]);
  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export const useNoteKey = () => useContext(KeyContext);
