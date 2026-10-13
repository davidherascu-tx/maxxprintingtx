"use server";

import { revalidatePath } from "next/cache";
import { baseProduct, type ProductOverride } from "./catalog";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  adminUpdateUser, createStaff, deleteOverride, deleteStaff, findOrder, findStaffByEmail, findStaffById, findUserById, moveApproval, ORDER_STATUSES,
  saveOverride, saveSettings, setOrderAdminNotes, setOrderPayment, setOrderStatus, setStaffPassword, setUserPassword, touchStaffLogin,
} from "./db";
import { endOfDayHouston } from "./dates";
import { saveProofImage, sniffImage } from "./files";
import { defaultSettings, mergeSettings, type StoreSettings } from "./settings";
import { hashPassword, verifyPassword } from "./session";
import { createStaffSession, deleteStaffSession, requireStaff } from "./staff-session";
import { getOverrides, getSettings } from "./store";

// Every action here re-checks that the caller is staff: actions are public endpoints,
// whatever page they are used from.

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Product and settings edits show up across the whole shop. */
const revalidateShop = () => revalidatePath("/", "layout");

// --- Orders -----------------------------------------------------------------

export async function updateOrderStatus(form: FormData) {
  await requireStaff();
  const status = ORDER_STATUSES.find((s) => s === str(form, "status"));
  if (!status) return;
  const order = await findOrder(str(form, "id"));
  if (!order) return;
  // Nothing goes to production before the artwork is approved.
  if (status !== "Received" && order.approval !== "approved") return;
  await setOrderStatus(order.id, status);
  revalidatePath("/admin", "layout");
  revalidatePath("/account");
}

export async function saveOrderNotes(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  await setOrderAdminNotes(str(form, "id"), str(form, "notes").slice(0, 5000));
  revalidatePath("/admin", "layout");
  return { ok: "Notes saved." };
}

/** Record a payment taken in person or by invoice. */
export async function recordPayment(form: FormData) {
  await requireStaff();
  const to = str(form, "to");
  if (to !== "paid" && to !== "invoice") return;
  await setOrderPayment(str(form, "id"), to);
  revalidatePath("/admin", "layout");
  revalidatePath("/account");
}

// --- Artwork approval -----------------------------------------------------------------

const MAX_PROOF_BYTES = 8 * 1000 * 1000;

const revalidateOrder = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/account");
};

/** Send the customer a proof: a message and optionally an image (the order's design previews are always shown). */
export async function sendProof(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = str(form, "id");
  const note = str(form, "note").slice(0, 3000);
  const file = form.get("image");
  let image: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PROOF_BYTES) return { error: "The proof image must be 8 MB or smaller." };
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { error: "The proof must be a PNG, JPG, WEBP or GIF image." };
    image = randomUUID();
    try {
      await saveProofImage(id, image, type, bytes);
    } catch (e) {
      console.error("Failed to save proof image", e);
      return { error: "We couldn't upload the proof image. Please try again." };
    }
  }
  const sent = await moveApproval(id, ["review", "changes_requested", "proof_sent"], "proof_sent", {
    actor: "staff",
    actorName: staff.name,
    kind: "proof_sent",
    note,
    image,
  });
  if (!sent) return { error: "This order can't get a proof right now (it may be approved already)." };
  revalidateOrder();
  return { ok: "Proof sent. The customer sees it in their account; let them know it's ready." };
}

/** Staff can't use the artwork as is: tell the customer what's needed. */
export async function flagArtwork(_: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const note = str(form, "note").slice(0, 3000);
  if (note.length < 5) return { error: "Tell the customer what's wrong or what you need." };
  const moved = await moveApproval(str(form, "id"), ["review", "changes_requested", "proof_sent"], "artwork_issue", {
    actor: "staff",
    actorName: staff.name,
    kind: "artwork_issue",
    note,
  });
  if (!moved) return { error: "This order's approval has already moved on. Reload the page." };
  revalidateOrder();
  return { ok: "Saved. The customer sees your message in their account." };
}

/** The customer sent what was needed: back to staff review. */
export async function artworkResolved(form: FormData) {
  const staff = await requireStaff();
  await moveApproval(str(form, "id"), ["artwork_issue"], "review", {
    actor: "staff",
    actorName: staff.name,
    kind: "artwork_ok",
    note: str(form, "note").slice(0, 3000),
  });
  revalidateOrder();
}

/** Record an approval the customer gave another way (phone, email, in store). */
export async function approveForCustomer(form: FormData) {
  const staff = await requireStaff();
  await moveApproval(str(form, "id"), ["review", "artwork_issue", "proof_sent", "changes_requested"], "approved", {
    actor: "staff",
    actorName: staff.name,
    kind: "approved_by_staff",
    note: str(form, "note").slice(0, 3000) || "Approved by the customer outside the website.",
  });
  revalidateOrder();
}

// --- Products -----------------------------------------------------------------

/** "" means price on request; otherwise dollars with up to 2 decimals. */
function parsePrice(raw: string): number | null | "invalid" {
  if (raw === "") return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return "invalid";
  return Math.round(n * 100) / 100;
}

/** Saves only what differs from the code catalog, so later code changes still apply to the rest. */
export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const base = baseProduct(str(form, "slug"));
  if (!base) return { error: "Product not found." };

  const o: ProductOverride = {};
  const name = str(form, "name");
  if (name.length < 2) return { error: "Please enter a product name." };
  if (name !== base.name) o.name = name.slice(0, 200);
  const description = str(form, "description");
  if (description && description !== base.description) o.description = description.slice(0, 5000);
  const featured = form.get("featured") === "on";
  if (featured !== !!base.featured) o.featured = featured;
  if (form.get("hidden") === "on") o.hidden = true;

  const variants: NonNullable<ProductOverride["variants"]> = {};
  let onSale = false;
  for (const v of base.variants) {
    const price = parsePrice(str(form, `price:${v.id}`));
    if (price === "invalid") return { error: `Check the price for ${v.label}.` };
    const sale = parsePrice(str(form, `sale:${v.id}`));
    if (sale === "invalid") return { error: `Check the sale price for ${v.label}.` };
    if (sale !== null && (price === null || sale >= price)) {
      return { error: `The sale price for ${v.label} must be lower than its regular price.` };
    }
    const hidden = form.get(`hidden:${v.id}`) === "on";
    const entry: { price?: number | null; salePrice?: number; hidden?: boolean } = {};
    if (price !== v.price) entry.price = price;
    if (sale !== null) {
      entry.salePrice = sale;
      onSale = true;
    }
    if (hidden) entry.hidden = true;
    if (Object.keys(entry).length) variants[v.id] = entry;
  }
  const saleEnds = str(form, "saleEnds");
  if (onSale && saleEnds) {
    const endsAt = endOfDayHouston(saleEnds);
    if (!endsAt) return { error: "Check the sale end date." };
    if (Date.parse(endsAt) <= Date.now()) return { error: "The sale end date has already passed. Pick today or a later day, or clear it." };
    o.saleEndsAt = endsAt;
  }
  if (base.variants.every((v) => variants[v.id]?.hidden)) {
    return { error: "At least one option must stay visible. To take the product off the shop, use \"Hide product\" instead." };
  }
  if (Object.keys(variants).length) o.variants = variants;

  if (Object.keys(o).length) await saveOverride(base.slug, o);
  else await deleteOverride(base.slug);
  revalidateShop();
  return { ok: "Product saved." };
}

/** Remove every sale price (and the end date), keeping the product's other edits. */
export async function endSale(form: FormData) {
  await requireStaff();
  const base = baseProduct(str(form, "slug"));
  if (!base) return;
  const current: ProductOverride = { ...(await getOverrides())[base.slug] };
  delete current.saleEndsAt;
  if (current.variants) {
    const variants = Object.fromEntries(
      Object.entries(current.variants)
        .map(([id, v]) => [id, Object.fromEntries(Object.entries(v).filter(([k]) => k !== "salePrice"))] as const)
        .filter(([, v]) => Object.keys(v).length),
    );
    if (Object.keys(variants).length) current.variants = variants;
    else delete current.variants;
  }
  if (Object.keys(current).length) await saveOverride(base.slug, current);
  else await deleteOverride(base.slug);
  revalidateShop();
}

export async function resetProduct(form: FormData) {
  await requireStaff();
  const base = baseProduct(str(form, "slug"));
  if (!base) return;
  await deleteOverride(base.slug);
  revalidateShop();
}

/** Show or hide a product from the products list, keeping its other edits. */
export async function setProductHidden(form: FormData) {
  await requireStaff();
  const base = baseProduct(str(form, "slug"));
  if (!base) return;
  const current = { ...(await getOverrides())[base.slug] };
  if (form.get("hidden") === "1") current.hidden = true;
  else delete current.hidden;
  if (Object.keys(current).length) await saveOverride(base.slug, current);
  else await deleteOverride(base.slug);
  revalidateShop();
}

// --- Customers -----------------------------------------------------------------

export async function updateCustomer(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  if (name.length < 2) return { error: "Please enter a name." };
  if (!EMAIL.test(email)) return { error: "Please enter a valid email." };
  const result = await adminUpdateUser(str(form, "id"), {
    name,
    email,
    phone: str(form, "phone") || undefined,
    company: str(form, "company") || undefined,
  });
  if (result === "taken") return { error: "Another account already uses that email." };
  if (!result) return { error: "Customer not found." };
  revalidatePath("/admin", "layout");
  return { ok: "Customer saved." };
}

/** Staff set a new password for a customer; their existing sessions are signed out. */
export async function resetCustomerPassword(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "The password must be at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match." };
  const user = await findUserById(str(form, "id"));
  if (!user) return { error: "Customer not found." };
  await setUserPassword(user.id, await hashPassword(password));
  return { ok: `Password updated. Give it to ${user.name} privately; they're signed out everywhere until they sign in with it.` };
}

// --- Staff sign-in -----------------------------------------------------------------

/** Only send staff back to admin pages after signing in. */
const adminNext = (next: string) => (/^\/admin(\/|$|\?)/.test(next) && !next.startsWith("/admin/login") ? next : "/admin");

export async function staffSignIn(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const staff = await findStaffByEmail(email);
  // Hash even when the email is unknown, so the response time doesn't reveal which emails are staff.
  const ok = staff ? await verifyPassword(password, staff.passwordHash) : (await hashPassword(password), false);
  if (!staff || !ok) return { error: "Incorrect email or password." };
  await createStaffSession(staff.id);
  await touchStaffLogin(staff.id);
  redirect(adminNext(str(form, "next")));
}

export async function staffSignOut() {
  await deleteStaffSession();
  redirect("/admin/login");
}

// --- Staff accounts -----------------------------------------------------------------

function checkNewPassword(form: FormData): string | { error: string } {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Staff passwords must be at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match." };
  return password;
}

export async function addStaff(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  if (name.length < 2) return { error: "Please enter their name." };
  if (!EMAIL.test(email)) return { error: "Please enter a valid email." };
  const password = checkNewPassword(form);
  if (typeof password !== "string") return password;
  const staff = await createStaff({ name, email, passwordHash: await hashPassword(password) });
  if (!staff) return { error: "There's already a staff login with that email." };
  revalidatePath("/admin", "layout");
  return { ok: `Staff login created for ${name}. Give them the password privately; they sign in at /admin/login.` };
}

export async function removeStaff(form: FormData) {
  const me = await requireStaff();
  const id = str(form, "id");
  // Don't let anyone lock themselves out by accident; the last login also can't be removed.
  if (id === me.id) return;
  await deleteStaff(id);
  revalidatePath("/admin", "layout");
}

/** Set another staff member's password (e.g. they forgot it). They're signed out everywhere. */
export async function setStaffMemberPassword(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const staff = await findStaffById(str(form, "id"));
  if (!staff) return { error: "Staff member not found." };
  const password = checkNewPassword(form);
  if (typeof password !== "string") return password;
  await setStaffPassword(staff.id, await hashPassword(password));
  return { ok: `Password updated for ${staff.name}.` };
}

/** Change your own password; you stay signed in on this device. */
export async function changeMyPassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  const staff = await findStaffById(me.id);
  if (!staff || !(await verifyPassword(String(form.get("current") ?? ""), staff.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  const password = checkNewPassword(form);
  if (typeof password !== "string") return password;
  await setStaffPassword(staff.id, await hashPassword(password));
  // Other devices are signed out by the change; start a fresh session here.
  await createStaffSession(staff.id);
  return { ok: "Your password was changed." };
}

// --- Settings -----------------------------------------------------------------

export async function saveStoreSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const current = await getSettings();
  const taxPercent = Number(str(form, "taxPercent"));
  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 25) return { error: "Tax rate must be between 0 and 25%." };
  const email = str(form, "email");
  if (!EMAIL.test(email)) return { error: "Please enter a valid email." };
  const name = str(form, "name");
  if (name.length < 2) return { error: "Please enter the business name." };
  const pickup = form.get("pickupEnabled") === "on";
  const delivery = form.get("deliveryEnabled") === "on";
  if (!pickup && !delivery) return { error: "Turn on pickup, delivery or both, or customers can't check out." };

  const next: StoreSettings = mergeSettings({
    site: {
      ...current.site,
      name,
      legalName: str(form, "legalName") || name,
      tagline: str(form, "tagline"),
      address: {
        line1: str(form, "line1"),
        line2: str(form, "line2"),
        city: str(form, "city"),
        state: str(form, "state"),
        zip: str(form, "zip"),
      },
      phone: str(form, "phoneDisplay").replace(/[^\d+]/g, ""),
      phoneDisplay: str(form, "phoneDisplay"),
      email,
      url: str(form, "url") || current.site.url,
    },
    // Stored as a fraction; round away float noise like 8.250000001.
    taxRate: Math.round(taxPercent * 1000) / 100000,
    pickup: { enabled: pickup, note: str(form, "pickupNote") || defaultSettings.pickup.note },
    delivery: { enabled: delivery, note: str(form, "deliveryNote") || defaultSettings.delivery.note },
  });
  await saveSettings(next);
  revalidateShop();
  return { ok: "Settings saved." };
}
