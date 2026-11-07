import type { Metadata } from "next";
import { Suspense } from "react";

import { NewFolderButton, NewPriceListButton } from "@/components/price-lists/action-buttons";
import {
  FolderPanel,
  IntroPanel,
  NotFoundPanel,
  PanelSkeleton,
  PriceListPanel,
} from "@/components/price-lists/panels";
import { PriceListTree, type Selection } from "@/components/price-lists/price-list-tree";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPriceListTree, PRICES_MAX, PRICES_PAGE } from "@/server/price-lists";

export const metadata: Metadata = { title: "Price lists" };

type Params = Awaited<PageProps<"/price-lists">["searchParams"]>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const positiveInt = (v: string) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

function readParams(params: Params) {
  const list = positiveInt(first(params.list));
  const folder = list ? null : positiveInt(first(params.folder));
  const selection: Selection = list ? { kind: "list", id: list } : folder ? { kind: "folder", id: folder } : null;
  const limit = Math.min(positiveInt(first(params.limit)) ?? PRICES_PAGE, PRICES_MAX);
  return {
    selection,
    query: first(params.q).slice(0, 200),
    manualOnly: first(params.manual) === "1",
    limit,
    rename: first(params.rename) === "1",
  };
}

async function PriceListsScreen({ searchParams }: { searchParams: Promise<Params> }) {
  const { selection, query, manualOnly, limit, rename } = readParams(await searchParams);
  const { folders, lists } = await getPriceListTree();

  // New items go into the folder that is open (or the selected list's folder).
  const currentFolder =
    selection?.kind === "folder"
      ? selection.id
      : selection?.kind === "list"
        ? (lists.find((l) => l.id === selection.id)?.folderId ?? null)
        : null;

  let panel: React.ReactNode;
  if (!selection) {
    panel = <IntroPanel />;
  } else if (selection.kind === "folder") {
    const folder = folders.find((f) => f.id === selection.id);
    panel = folder ? (
      <FolderPanel folder={folder} folders={folders} lists={lists} rename={rename} />
    ) : (
      <NotFoundPanel what="folder" />
    );
  } else {
    const list = lists.find((l) => l.id === selection.id);
    panel = list ? (
      <PriceListPanel
        list={list}
        folders={folders}
        query={query}
        manualOnly={manualOnly}
        limit={limit}
        rename={rename}
      />
    ) : (
      <NotFoundPanel what="price list" />
    );
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className={selection ? "hidden md:flex md:sticky md:top-6" : "md:sticky md:top-6"} size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <NewFolderButton parentId={currentFolder} />
            <NewPriceListButton folderId={currentFolder} />
          </div>
          <PriceListTree folders={folders} lists={lists} selected={selection} />
        </CardContent>
      </Card>
      {panel}
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div className="grid items-start gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
      <PanelSkeleton />
    </div>
  );
}

export default function PriceListsPage({ searchParams }: PageProps<"/price-lists">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Price lists</h1>
      <Suspense fallback={<ScreenSkeleton />}>
        <PriceListsScreen searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
