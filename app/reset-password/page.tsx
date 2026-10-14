import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/auth-forms";
import { readResetToken } from "@/lib/verification";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await readResetToken(token);
  if (!user || !token) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work for 1 hour and only once.">
        <Link href="/forgot-password" className="btn-primary w-full">Send me a new link</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}`}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
