import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (await getCurrentUser()) redirect(target);

  return (
    <AuthShell title="Create your account" subtitle="Save your details, check out faster and see your order history.">
      <SignUpForm next={target} />
    </AuthShell>
  );
}
