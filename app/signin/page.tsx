import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (await getCurrentUser()) redirect(target);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to check out and track your orders.">
      <SignInForm next={target} />
    </AuthShell>
  );
}
