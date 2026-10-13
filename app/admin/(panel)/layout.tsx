import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { staffSignOut } from "@/lib/admin-actions";
import { getCurrentStaff } from "@/lib/staff-session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every page calls requireStaff with its own path (so sign-in returns there), and every
  // action checks too: a layout isn't re-run on each navigation, so it can't be the guard.
  const staff = await getCurrentStaff();
  if (!staff) return children;
  return (
    <div className="container-x py-8 lg:grid lg:grid-cols-[12rem_1fr] lg:gap-8 print:block print:p-0">
      <aside className="mb-6 print:hidden lg:mb-0">
        <div className="mb-3 flex items-center justify-between gap-2 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Admin · {staff.name.split(" ")[0]}</p>
          <form action={staffSignOut} className="lg:hidden">
            <button type="submit" className="text-sm text-ink/60 hover:text-magenta">Sign out</button>
          </form>
        </div>
        <AdminNav />
        <form action={staffSignOut} className="mt-6 hidden border-t border-line pt-4 lg:block">
          <button type="submit" className="px-3 text-sm text-ink/60 hover:text-magenta">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
