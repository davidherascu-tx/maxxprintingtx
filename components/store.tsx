"use client";

import { createContext, useContext, useMemo } from "react";
import { makeCatalog, type Catalog, type Overrides } from "@/lib/catalog";
import type { PublicSettings } from "@/lib/settings";

type StoreValue = { catalog: Catalog; settings: PublicSettings };

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Gives client components the same catalog and settings as the server. Only the admin overrides
 * are sent down; the code catalog is already in the bundle.
 */
export function StoreProvider({
  overrides,
  settings,
  now,
  children,
}: {
  overrides: Overrides;
  settings: PublicSettings;
  /** The server's clock for this page, so sales match what the server rendered. */
  now: number;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ catalog: makeCatalog(overrides, now), settings }), [overrides, settings, now]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCatalog/useStoreSettings must be used inside <StoreProvider>");
  return ctx;
}

export const useCatalog = () => useStore().catalog;
export const useStoreSettings = () => useStore().settings;
