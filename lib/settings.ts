import { defaultSite, type Site } from "./site";
import { DEFAULT_TAX_RATE } from "./tax";

/** Store settings staff can edit in Admin → Settings. Missing fields fall back to these defaults. */
export type StoreSettings = {
  site: Site;
  /** Sales tax as a fraction, e.g. 0.0825. */
  taxRate: number;
  pickup: { enabled: boolean; note: string };
  delivery: { enabled: boolean; note: string };
  /** Where shop notifications (new orders) are emailed. Not shown on the site. */
  notifyEmail: string;
  /** When false, customers can browse but not order, and see a "shop is closed" popup. */
  shopOpen: boolean;
  /** Return & refund policy, shown on the Ordering page, at checkout and on refund requests. */
  returnPolicy: string;
};

export const defaultSettings: StoreSettings = {
  site: defaultSite,
  taxRate: DEFAULT_TAX_RATE,
  pickup: { enabled: true, note: `${defaultSite.address.line1}, ${defaultSite.address.line2}, ${defaultSite.address.city}` },
  delivery: { enabled: true, note: "Delivery cost is quoted and invoiced separately" },
  notifyEmail: "orders@maxxprinthtx.com",
  shopOpen: true,
  returnPolicy:
    "Everything we make is printed just for you, so custom items can't be returned or exchanged. If your order arrives misprinted, damaged or different from the design you ordered, tell us within 7 days of pickup or delivery and we'll reprint it or refund you. Refunds go back to the card you paid with and usually show up in 5 to 10 business days.",
};

/** Saved settings over the defaults, field by field, so a partial or older saved value still works. */
export function mergeSettings(saved: Partial<StoreSettings> | null | undefined): StoreSettings {
  const d = defaultSettings;
  return {
    site: { ...d.site, ...saved?.site, address: { ...d.site.address, ...saved?.site?.address } },
    taxRate: typeof saved?.taxRate === "number" ? saved.taxRate : d.taxRate,
    pickup: { ...d.pickup, ...saved?.pickup },
    delivery: { ...d.delivery, ...saved?.delivery },
    notifyEmail: typeof saved?.notifyEmail === "string" && saved.notifyEmail ? saved.notifyEmail : d.notifyEmail,
    shopOpen: typeof saved?.shopOpen === "boolean" ? saved.shopOpen : d.shopOpen,
    returnPolicy: typeof saved?.returnPolicy === "string" && saved.returnPolicy.trim() ? saved.returnPolicy : d.returnPolicy,
  };
}

/** The part of the settings the browser needs (cart totals, checkout options). */
export type PublicSettings = Pick<StoreSettings, "taxRate" | "pickup" | "delivery" | "returnPolicy" | "shopOpen">;
