"use client";

import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { byName, describeRule } from "@/lib/price-lists/folders";
import { priceListsHref } from "@/lib/price-lists/href";
import type { FolderRow, PriceListRow } from "@/server/price-lists";

const CLOSED_KEY = "asm-books:price-lists:closed-folders";

export type Selection = { kind: "folder" | "list"; id: number } | null;

// Folders start open; the ones the user closes are remembered on this device.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const readSaved = () => localStorage.getItem(CLOSED_KEY) ?? "[]";

function useClosedFolders() {
  const raw = useSyncExternalStore(subscribe, readSaved, () => "[]");
  const closed = useMemo(() => {
    try {
      const saved: unknown = JSON.parse(raw);
      return new Set(Array.isArray(saved) ? saved.filter(Number.isInteger) : []);
    } catch {
      return new Set<number>();
    }
  }, [raw]);

  const toggle = (id: number) => {
    const next = new Set(closed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
    listeners.forEach((l) => l());
  };

  return { closed, toggle };
}

export function PriceListTree({
  folders,
  lists,
  selected,
}: {
  folders: FolderRow[];
  lists: PriceListRow[];
  selected: Selection;
}) {
  const { closed, toggle } = useClosedFolders();
  const isSelected = (kind: "folder" | "list", id: number) => selected?.kind === kind && selected.id === id;

  // Keep the selected item visible even if its folder was closed.
  const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));
  const forcedOpen = new Set<number>();
  let p =
    selected?.kind === "list"
      ? (lists.find((l) => l.id === selected.id)?.folderId ?? null)
      : selected?.kind === "folder"
        ? (parentOf.get(selected.id) ?? null)
        : null;
  for (let guard = 0; p != null && guard < 50; guard++) {
    forcedOpen.add(p);
    p = parentOf.get(p) ?? null;
  }

  const level = (parentId: number | null, depth: number): React.ReactNode[] => {
    if (depth > 50) return [];
    const childFolders = folders.filter((f) => f.parentId === parentId).sort(byName);
    const childLists = lists.filter((l) => l.folderId === parentId).sort((a, b) => a.sort - b.sort || byName(a, b));

    return [
      ...childFolders.map((f) => {
        const open = forcedOpen.has(f.id) || !closed.has(f.id);
        return (
          <li key={`f${f.id}`} role="treeitem" aria-expanded={open} aria-selected={isSelected("folder", f.id)}>
            <div
              className={cn(
                "flex items-center gap-1 rounded-md pr-2 hover:bg-muted",
                isSelected("folder", f.id) && "bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(f.id)}
                aria-label={`${open ? "Close" : "Open"} folder ${f.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
              </button>
              <Link
                href={priceListsHref({ folder: f.id })}
                scroll={false}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm font-medium"
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
              </Link>
            </div>
            {open && (
              <ul role="group" className="ml-3.5 border-l pl-1.5">
                {level(f.id, depth + 1)}
              </ul>
            )}
          </li>
        );
      }),
      ...childLists.map((l) => (
        <li key={`l${l.id}`} role="treeitem" aria-selected={isSelected("list", l.id)}>
          <Link
            href={priceListsHref({ list: l.id })}
            scroll={false}
            className={cn(
              "ml-7 flex flex-col rounded-md px-2 py-1.5 hover:bg-muted",
              isSelected("list", l.id) && "bg-muted",
              !l.enabled && "opacity-60",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{l.name}</span>
              {!l.enabled && <Badge variant="outline">off</Badge>}
            </span>
            <span className="truncate text-xs text-muted-foreground">{describeRule(l)}</span>
          </Link>
        </li>
      )),
    ];
  };

  const items = level(null, 0);
  return items.length === 0 ? (
    <p className="p-4 text-sm text-muted-foreground">No price lists yet.</p>
  ) : (
    <ul role="tree" aria-label="Price lists" className="flex flex-col gap-0.5">
      {items}
    </ul>
  );
}
