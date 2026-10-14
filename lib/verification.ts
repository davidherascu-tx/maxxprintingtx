import "server-only";
import { createHash } from "node:crypto";
import { claimResetEmail, claimVerificationEmail, findUserById } from "./db";
import { emailActivateAccount, emailPasswordReset, origin } from "./email";
import { decodeToken, encodeToken } from "./session";
import { getSite } from "./store";

// Account activation links. The token is signed (like the session cookie), lasts 48 hours, and
// names both the account and its email, so it stops working if the email address changes.

const MAX_AGE = 60 * 60 * 48;

/** Send (or re-send) the activation email, at most once every two minutes. Returns whether it went out. */
export async function sendActivationEmail(user: { id: string; name: string; email: string }, next = "/account") {
  if (!(await claimVerificationEmail(user.id))) return false;
  const token = encodeToken("verify", `${user.id}|${user.email.toLowerCase()}`, MAX_AGE);
  const base = await origin(await getSite());
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}${next !== "/account" ? `&next=${encodeURIComponent(next)}` : ""}`;
  await emailActivateAccount(user, link);
  return true;
}

/** The account and email an activation link is for, or null if it's invalid or expired. */
export function readActivationToken(token: string | null) {
  const session = decodeToken(token ?? undefined, "verify");
  if (!session) return null;
  const [userId, email] = session.uid.split("|");
  return userId && email ? { userId, email } : null;
}

// --- Forgot password -----------------------------------------------------------------
// The reset link names the account and a fingerprint of its current password hash, so it works
// once: after the password changes, the fingerprint no longer matches. It lasts 1 hour.

const RESET_MAX_AGE = 60 * 60;
const fingerprint = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);

/** Send a reset link, at most once every two minutes per account. */
export async function sendPasswordResetEmail(user: { id: string; name: string; email: string; passwordHash: string }) {
  if (!(await claimResetEmail(user.id))) return false;
  const token = encodeToken("reset", `${user.id}|${fingerprint(user.passwordHash)}`, RESET_MAX_AGE);
  const base = await origin(await getSite());
  await emailPasswordReset(user, `${base}/reset-password?token=${encodeURIComponent(token)}`);
  return true;
}

/** The account a reset link is for, if the link is valid, unexpired and unused. */
export async function readResetToken(token: string | null | undefined) {
  const session = decodeToken(token ?? undefined, "reset");
  if (!session) return null;
  const [userId, fp] = session.uid.split("|");
  const user = userId ? await findUserById(userId) : undefined;
  return user && fp === fingerprint(user.passwordHash) ? user : null;
}
