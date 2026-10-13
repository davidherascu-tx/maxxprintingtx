import "server-only";
import { claimVerificationEmail } from "./db";
import { emailActivateAccount, origin } from "./email";
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
