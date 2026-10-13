import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-session";
import { StaffSignInForm } from "@/components/admin/staff-sign-in";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentStaff()) redirect("/admin");
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-sm rounded-2xl border border-line p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-magenta">Staff only</p>
        <h1 className="mt-1 font-display text-3xl text-navy">Admin sign in</h1>
        <p className="mt-2 text-sm text-ink/60">Use your staff login. Customer accounts can&apos;t sign in here.</p>
        <div className="mt-6">
          <StaffSignInForm next={next ?? "/admin"} />
        </div>
      </div>
    </div>
  );
}
