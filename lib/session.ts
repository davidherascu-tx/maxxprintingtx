import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { findUserById } from "./db";
import { activationRequired } from "./email";

export const SESSION_COOKIE = "maxx_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-insecure-secret";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const hash = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** "verify": the link in an account activation email. */
type TokenKind = "customer" | "staff" | "verify";

/** A signed, expiring token for a customer or staff session. */
export function encodeToken(kind: TokenKind, id: string, maxAgeSeconds: number) {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ k: kind, uid: id, iat: now, exp: now + maxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify a token and that it is of the expected kind, so a customer cookie can never open the admin. */
export function decodeToken(token: string | undefined, kind: TokenKind): { uid: string; iat: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { k, uid, iat, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    // Customer sessions from before `k` and `iat` were added: kind customer, issued at time 0.
    if ((k ?? "customer") !== kind) return null;
    return typeof uid === "string" && exp > Date.now() ? { uid, iat: typeof iat === "number" ? iat : 0 } : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, encodeToken("customer", userId, MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user (without password hash), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = decodeToken((await cookies()).get(SESSION_COOKIE)?.value, "customer");
  if (!session) return null;
  const user = await findUserById(session.uid);
  if (!user) return null;
  // Staff reset this password after the session was created: sign it out.
  if (user.passwordChangedAt && session.iat < Date.parse(user.passwordChangedAt)) return null;
  if (!user.emailVerifiedAt && activationRequired()) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, company: user.company, createdAt: user.createdAt };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
