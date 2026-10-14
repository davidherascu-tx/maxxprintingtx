"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatAddress, readAddress, type Address } from "./address";
import {
  claimDesigns, createOrder, createUser, deleteDesign, deleteUnpaidOrder, findDesign, findOrder, findUserByEmail,
  addOrderEvent, markEmailVerified, requestRefund, saveUserAddresses, setUserPassword, unpaidOrdersForUser, updateUser,
} from "./db";
import { deleteDesignFiles } from "./files";
import { deleteStaffSession } from "./staff-session";
import { activationRequired, emailConfigured, emailRefundRequested } from "./email";
import { readResetToken, sendActivationEmail, sendPasswordResetEmail } from "./verification";
import { createSession, deleteSession, getCurrentUser, hashPassword, verifyPassword } from "./session";
import { colorOf } from "./catalog";
import { getCatalog, getSettings } from "./store";
import { requiresDesign } from "./design-config";
import { expireSession, paymentsConfigured, startCheckout } from "./payments";
import { calcTax } from "./tax";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// Only allow redirecting back to paths on this site.
const originOf = async () => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/account");

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const phone = str(form, "phone");
  const company = str(form, "company");

  if (name.length < 2) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const next = safeNext(str(form, "next"));
  // Activation is optional (see activationRequired); when it's off, accounts are active straight away.
  const confirm = activationRequired();
  const user = await createUser({
    name,
    email,
    phone: phone || undefined,
    company: company || undefined,
    passwordHash: await hashPassword(password),
    verified: !confirm,
  });
  if (!user) {
    // Signed up before but never confirmed: send the link again rather than a dead end.
    const existing = await findUserByEmail(email);
    if (confirm && existing && !existing.emailVerifiedAt) {
      await sendActivationEmail(existing, next);
      return { ok: `We've sent a new activation link to ${email}. Click it to finish creating your account.` };
    }
    return { error: "An account with this email already exists. Try signing in." };
  }

  if (!confirm) {
    await createSession(user.id);
    redirect(next);
  }
  await sendActivationEmail(user, next);
  return { ok: `Almost done! We've sent an email to ${email}. Click the link in it to activate your account.` };
}

/** "Resend the activation email" on the sign-in page. Same answer whether or not the account exists. */
export async function resendActivation(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };
  const user = await findUserByEmail(email);
  if (activationRequired() && user && !user.emailVerifiedAt) await sendActivationEmail(user, safeNext(str(form, "next")));
  return { ok: "If that account still needs activating, we've sent a new link. Check your inbox and spam folder." };
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  if (activationRequired() && !user.emailVerifiedAt) {
    const sent = await sendActivationEmail(user, safeNext(str(form, "next")));
    return {
      error: sent
        ? `Please activate your account first. We've just sent a new activation link to ${email}.`
        : `Please activate your account first using the link we emailed to ${email}. (Check your spam folder.)`,
    };
  }
  await createSession(user.id);
  redirect(safeNext(str(form, "next")));
}

export async function signOut() {
  await deleteSession();
  redirect("/");
}

/** The header's "Sign out": ends the customer and the staff session, whichever exist. */
export async function signOutAll() {
  await Promise.all([deleteSession(), deleteStaffSession()]);
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const name = str(form, "name");
  if (name.length < 2) return { error: "Please enter your name." };
  await updateUser(user.id, {
    name,
    phone: str(form, "phone") || undefined,
    company: str(form, "company") || undefined,
  });
  revalidatePath("/account");
  return { ok: "Profile saved." };
}

export async function removeDesign(id: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const result = await deleteDesign(id, user.id);
  if (!result) return { error: "That design could not be found." };
  // The row is already gone, so a failed file cleanup only leaves orphaned blobs behind.
  if (result.removed) await deleteDesignFiles(id).catch((e) => console.error("Failed to delete design files", id, e));
  revalidatePath("/account");
  return { ok: "Design deleted." };
}

export async function placeOrder(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/checkout");

  let raw: { slug: string; variant: string; color?: string; qty: number; designId?: string }[];
  try {
    raw = JSON.parse(String(form.get("cart") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
  } catch {
    return { error: "Your cart could not be read. Please try again." };
  }

  // Re-price every line from the catalog (with admin edits); never trust client prices.
  const [{ getProduct }, settings] = await Promise.all([getCatalog(), getSettings()]);
  const items = (
    await Promise.all(
      raw.map(async (line) => {
        const product = getProduct(line.slug);
        const variant = product?.variants.find((v) => v.id === line.variant);
        const qty = product?.noQty ? 1 : Math.floor(Number(line.qty));
        if (!product || !variant || variant.price === null || !(qty >= 1 && qty <= 10000)) return null;
        if (requiresDesign(product.slug) && !line.designId) return null;
        // Lines without a color (e.g. from the Design Studio) get the product's default color.
        const color = colorOf(product, line.color);
        if (line.color && color?.id !== line.color) return null;
        // A design must exist, be for this product, and not belong to someone else.
        const design = line.designId ? await findDesign(String(line.designId)) : undefined;
        if (line.designId && (!design || design.slug !== product.slug || (design.userId && design.userId !== user.id))) {
          return null;
        }
        return {
          slug: product.slug,
          name: product.name,
          variant: variant.label,
          ...(color && { color: color.label }),
          price: variant.price,
          qty,
          ...(design && { designId: design.id, preview: `/api/designs/${design.id}/${design.sides[0]}-preview.png` }),
        };
      }),
    )
  ).filter((i) => i !== null);
  if (items.length === 0) return { error: "Your cart is empty." };
  if (items.length !== raw.length) return { error: "Some items in your cart are no longer available. Please review your cart." };

  const designIds = items.flatMap((i) => (i.designId ? [i.designId] : []));
  if (designIds.length) await claimDesigns(designIds, user.id);

  const fulfillment = str(form, "fulfillment") === "delivery" ? "delivery" : "pickup";
  if (!settings[fulfillment].enabled) {
    return { error: fulfillment === "delivery" ? "Delivery isn't available right now. Please choose pickup." : "Store pickup isn't available right now. Please choose delivery." };
  }
  const billingAddress = readAddress(form, "billing");
  if (!billingAddress) return { error: "Please enter your billing address." };
  if (typeof billingAddress === "string") return { error: `Billing address: ${billingAddress}` };
  let shippingAddress: Address | undefined;
  if (fulfillment === "delivery") {
    const same = form.get("shippingSame") === "on";
    const ship = same ? billingAddress : readAddress(form, "shipping");
    if (!ship) return { error: "Please enter a delivery address." };
    if (typeof ship === "string") return { error: `Delivery address: ${ship}` };
    shippingAddress = ship;
  }
  if (form.get("saveAddresses") === "on") {
    const keepShipping = fulfillment === "delivery" ? (form.get("shippingSame") === "on" ? null : shippingAddress!) : (user.shippingAddress ?? null);
    await saveUserAddresses(user.id, billingAddress, keepShipping);
  }

  if (!paymentsConfigured()) {
    return { error: "Online payments aren't available right now. Please call us to place your order." };
  }
  await discardUnpaidOrders(user.id);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order = await createOrder({
    userId: user.id,
    items,
    subtotal,
    tax: calcTax(subtotal, settings.taxRate),
    notes: str(form, "notes").slice(0, 2000),
    fulfillment,
    address: shippingAddress ? formatAddress(shippingAddress) : undefined,
    billingAddress,
    shippingAddress,
  });

  let url: string;
  try {
    url = await startCheckout(order, user.email, await originOf());
  } catch (e) {
    console.error("Failed to start checkout:", e instanceof Error ? `${e.name}: ${e.message}` : String(e), (e as { type?: string; code?: string }).type ?? "", (e as { code?: string }).code ?? "");
    await deleteUnpaidOrder(order.id);
    return { error: "We couldn't start the payment. Please try again." };
  }
  revalidatePath("/account");
  redirect(url);
}

/** A customer's earlier unpaid attempts are replaced by the new one (never a paid or in-flight one). */
async function discardUnpaidOrders(userId: string) {
  for (const old of await unpaidOrdersForUser(userId)) {
    try {
      if (!old.stripeSessionId || (await expireSession(old.stripeSessionId))) await deleteUnpaidOrder(old.id);
    } catch (e) {
      console.error("Could not discard unpaid order", old.number, e);
    }
  }
}

/** Pay for an order that was saved but not paid (e.g. the customer left the payment page). */
export async function payOrder(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const order = await findOrder(str(form, "id"));
  if (!order || order.userId !== user.id || order.paymentStatus !== "unpaid" || !paymentsConfigured()) redirect("/account");
  // If the earlier checkout was actually completed, confirm it instead of charging twice.
  let completed = false;
  if (order.stripeSessionId) {
    try {
      completed = !(await expireSession(order.stripeSessionId));
    } catch (e) {
      console.error("Could not check earlier checkout", e);
    }
  }
  if (completed) redirect(`/account?order=${order.number}&session_id=${order.stripeSessionId}`);

  let url: string | undefined;
  try {
    url = await startCheckout(order, user.email, await originOf());
  } catch (e) {
    console.error("Failed to start checkout:", e instanceof Error ? `${e.name}: ${e.message}` : String(e), (e as { type?: string; code?: string }).type ?? "", (e as { code?: string }).code ?? "");
  }
  if (!url) redirect("/account?payment_error=1");
  redirect(url);
}


/** "Forgot password?": email a reset link. Same answer whether or not the account exists. */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email." };
  if (!emailConfigured()) return { error: "Password reset by email isn't available right now. Please call us and we'll help." };
  const user = await findUserByEmail(email);
  if (user) await sendPasswordResetEmail(user);
  return { ok: `If ${email} has an account, we've sent it a link to choose a new password. Check your inbox and spam folder; the link works for 1 hour.` };
}

/** The form behind the reset link: set the new password, then sign in. */
export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await readResetToken(str(form, "token"));
  if (!user) return { error: "This reset link has expired or was already used. Please ask for a new one." };
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match." };
  await setUserPassword(user.id, await hashPassword(password));
  // They got the link by email, so the address is confirmed too.
  if (!user.emailVerifiedAt) await markEmailVerified(user.id, user.email);
  await createSession(user.id);
  redirect("/account?password_reset=1");
}

/** Save one address from My account → Addresses (the other one stays as it is). */
export async function saveMyAddress(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const kind = str(form, "kind") === "shipping" ? "shipping" : "billing";
  if (kind === "shipping" && form.get("shippingSame") === "on") {
    await saveUserAddresses(user.id, user.billingAddress ?? null, null);
  } else {
    const address = readAddress(form, kind);
    if (!address) return { error: "Please fill in the address." };
    if (typeof address === "string") return { error: address };
    if (kind === "billing") await saveUserAddresses(user.id, address, user.shippingAddress ?? null);
    else await saveUserAddresses(user.id, user.billingAddress ?? null, address);
  }
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: kind === "billing" ? "Billing address saved." : "Shipping address saved." };
}

/** My account → Profile: change the password (needs the current one). Other devices are signed out. */
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/signin");
  const user = await findUserByEmail(current.email);
  if (!user || !(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "The new password must be at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The new passwords don't match." };
  if (await verifyPassword(password, user.passwordHash)) return { error: "That's your current password. Choose a new one." };
  await setUserPassword(user.id, await hashPassword(password));
  // The change signs out every session; start a fresh one on this device.
  await createSession(user.id);
  return { ok: "Password changed. You're still signed in here; other devices were signed out." };
}

/** My account → an order → "Request a refund". */
export async function requestRefundAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const reason = str(form, "reason").slice(0, 3000);
  if (reason.length < 10) return { error: "Please tell us what went wrong (a sentence or two)." };
  const order = await findOrder(str(form, "id"));
  if (!order || order.userId !== user.id) return { error: "Order not found." };
  if (!(await requestRefund(order.id, user.id, reason))) return { error: "This order already has a refund request or was refunded." };
  await addOrderEvent(order.id, { actor: "customer", actorName: user.name, kind: "refund_requested", note: reason });
  await emailRefundRequested(order, user, reason);
  revalidatePath("/account");
  revalidatePath("/admin", "layout");
  return { ok: "Thanks. We got your request and will get back to you within 1 to 2 business days." };
}
