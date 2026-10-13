import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { findStaffById } from "./db";
import { decodeToken, encodeToken } from "./session";

// Staff sign in at /admin/login with their own accounts (the staff table), never a
// customer account. The cookie is separate from the customer one, and its token is marked
// "staff" so neither cookie can stand in for the other.

export const STAFF_COOKIE = "maxx_staff";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createStaffSession(staffId: string) {
  (await cookies()).set(STAFF_COOKIE, encodeToken("staff", staffId, MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict: the admin is never entered from a link on another site with the session attached.
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}

/** The signed-in staff member (without password hash), or null. Cached per request. */
export const getCurrentStaff = cache(async () => {
  const session = decodeToken((await cookies()).get(STAFF_COOKIE)?.value, "staff");
  if (!session) return null;
  const staff = await findStaffById(session.uid).catch(() => undefined);
  if (!staff) return null;
  // Password changed after this session started: sign it out.
  if (staff.passwordChangedAt && session.iat < Date.parse(staff.passwordChangedAt)) return null;
  return { id: staff.id, name: staff.name, email: staff.email };
});

/** For admin pages and actions: the signed-in staff member, or off to the staff sign-in. */
export async function requireStaff(next = "/admin") {
  const staff = await getCurrentStaff();
  if (!staff) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return staff;
}
