import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { makeCatalog, type Overrides } from "./catalog";
import { loadOverrides, loadSettings } from "./db";
import { mergeSettings, type PublicSettings, type StoreSettings } from "./settings";

/** Product edits from Admin → Products, loaded once per request. */
// connection(): this data can change at any time, so never bake it into a page at build time.
export const getOverrides = cache(async () => {
  await connection();
  return (await loadOverrides()) as Overrides;
});

/** One clock per request, shared with the browser, so a sale that ends mid-request doesn't half apply. */
export const getNow = cache(() => Date.now());

/** The catalog with admin edits (and running sales) applied. Cached per request. */
export const getCatalog = cache(async () => makeCatalog(await getOverrides(), getNow()));

/** Store settings from Admin → Settings over the code defaults. Cached per request. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  await connection();
  return mergeSettings((await loadSettings()) as Partial<StoreSettings> | null);
});

export const getSite = async () => (await getSettings()).site;

export async function getPublicSettings(): Promise<PublicSettings> {
  const { taxRate, pickup, delivery } = await getSettings();
  return { taxRate, pickup, delivery };
}
