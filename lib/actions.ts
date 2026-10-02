"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claimDesigns, createOrder, createUser, findDesign, findUserByEmail, updateUser } from "./db";
import { createSession, deleteSession, getCurrentUser, hashPassword, verifyPassword } from "./session";
import { colorOf, getProduct } from "./catalog";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// Only allow redirecting back to paths on this site.
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

  const user = await createUser({
    name,
    email,
    phone: phone || undefined,
    company: company || undefined,
    passwordHash: await hashPassword(password),
  });
  if (!user) return { error: "An account with this email already exists." };

  await createSession(user.id);
  redirect(safeNext(str(form, "next")));
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  redirect(safeNext(str(form, "next")));
}

export async function signOut() {
  await deleteSession();
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

  // Re-price every line from the catalog; never trust client prices.
  const items = (
    await Promise.all(
      raw.map(async (line) => {
        const product = getProduct(line.slug);
        const variant = product?.variants.find((v) => v.id === line.variant);
        const qty = product?.noQty ? 1 : Math.floor(Number(line.qty));
        if (!product || !variant || variant.price === null || !(qty >= 1 && qty <= 10000)) return null;
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
  const address = str(form, "address");
  if (fulfillment === "delivery" && address.length < 8) {
    return { error: "Please enter a delivery address." };
  }

  const order = await createOrder({
    userId: user.id,
    items,
    subtotal: items.reduce((sum, i) => sum + i.price * i.qty, 0),
    notes: str(form, "notes").slice(0, 2000),
    fulfillment,
    address: fulfillment === "delivery" ? address : undefined,
  });

  revalidatePath("/account");
  redirect(`/account?order=${order.number}`);
}
