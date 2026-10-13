import { redirect } from "next/navigation";
import { markEmailVerified } from "@/lib/db";
import { createSession } from "@/lib/session";
import { readActivationToken } from "@/lib/verification";

/** The link in the activation email: activate the account, sign in, and go back to where they were. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const link = readActivationToken(url.searchParams.get("token"));
  const user = link ? await markEmailVerified(link.userId, link.email) : undefined;
  if (!user) redirect("/signin?activation=expired");
  await createSession(user.id);
  const next = url.searchParams.get("next") ?? "";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  redirect(`${target}${target.includes("?") ? "&" : "?"}activated=1`);
}
