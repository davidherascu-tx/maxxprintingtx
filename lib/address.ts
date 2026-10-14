/** A postal address, saved on the customer's account and copied onto each order. */
export type Address = {
  name: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
};

export const ADDRESS_FIELDS = ["name", "company", "line1", "line2", "city", "state", "zip", "phone"] as const;
const REQUIRED: (keyof Address)[] = ["name", "line1", "city", "state", "zip"];

/** Address lines for display (each item one line). */
export const addressLines = (a: Address) =>
  [a.name, a.company, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`, a.phone].filter((l): l is string => !!l && !!l.trim());

export const formatAddress = (a: Address) => addressLines(a).join("\n");

/** Read an address from form fields named `<prefix>.<field>`. Returns null if empty, or an error message. */
export function readAddress(form: FormData, prefix: string): Address | null | string {
  const get = (k: string) => String(form.get(`${prefix}.${k}`) ?? "").trim().slice(0, 200);
  const a = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, get(k)])) as Record<(typeof ADDRESS_FIELDS)[number], string>;
  if (ADDRESS_FIELDS.every((k) => !a[k])) return null;
  const missing = REQUIRED.filter((k) => !a[k]);
  if (missing.length) return `Please fill in the ${missing.map((k) => ({ name: "name", line1: "street address", city: "city", state: "state", zip: "ZIP code" })[k as string]).join(", ")}.`;
  if (!/^\d{5}(-\d{4})?$/.test(a.zip)) return "Please enter a 5-digit ZIP code.";
  return {
    name: a.name,
    ...(a.company && { company: a.company }),
    line1: a.line1,
    ...(a.line2 && { line2: a.line2 }),
    city: a.city,
    state: a.state.toUpperCase(),
    zip: a.zip,
    ...(a.phone && { phone: a.phone }),
  };
}

/** A saved value from the database, if it looks like an address. */
export const asAddress = (v: unknown): Address | undefined =>
  v && typeof v === "object" && typeof (v as Address).line1 === "string" ? (v as Address) : undefined;

/** Billing + shipping from an address form ("shippingSame" checked = no separate shipping address). */
export function readAddressBook(form: FormData): { billing: Address | null; shipping: Address | null } | string {
  const billing = readAddress(form, "billing");
  if (typeof billing === "string") return `Billing address: ${billing}`;
  if (form.get("shippingSame") === "on") return { billing, shipping: null };
  const shipping = readAddress(form, "shipping");
  if (typeof shipping === "string") return `Shipping address: ${shipping}`;
  return { billing, shipping };
}
