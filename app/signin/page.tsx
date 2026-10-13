import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { ResendActivation, SignInForm } from "@/components/auth-forms";
import { activationRequired } from "@/lib/email";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; activation?: string }> }) {
  const { next, activation } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (await getCurrentUser()) redirect(target);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to check out and track your orders.">
      {activationRequired() && activation === "expired" && (
        <p className="mb-4 rounded-lg bg-yellow/20 px-3 py-2 text-sm text-navy" role="alert">
          That activation link is invalid or has expired. Sign in below and we&apos;ll email you a new one.
        </p>
      )}
      <SignInForm next={target} />
      {activationRequired() && (
        <div className="mt-4">
          <ResendActivation next={target} />
        </div>
      )}
    </AuthShell>
  );
}
