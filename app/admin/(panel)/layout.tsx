import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { staffSignOut } from "@/lib/admin-actions";
import { getCurrentStaff } from "@/lib/staff-session";
import { countStaffTodo } from "@/lib/db";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every page calls requireStaff with its own path (so sign-in returns there), and every
  // action checks too: a layout isn't re-run on each navigation, so it can't be the guard.
  const staff = await getCurrentStaff();
  if (!staff) return children;
  const todo = await countStaffTodo();
  return (
    <div className="container-x py-8 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8 print:block print:p-0">
      <aside className="mb-6 print:hidden lg:mb-0">
        <div className="mb-3 flex items-center justify-between gap-2 lg:block">
          <p className="text-sm font-semibold text-ink/60">👋 Hi, {staff.name.split(" ")[0]}</p>
          <form action={staffSignOut} className="lg:hidden">
            <button type="submit" className="text-sm text-ink/60 hover:text-magenta">Sign out</button>
          </form>
        </div>
        <AdminNav todo={todo} />
        <form action={staffSignOut} className="mt-4 hidden lg:block">
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-ink/60 ring-1 ring-line hover:bg-mist hover:text-magenta">
            <span aria-hidden className="text-xl">🚪</span> Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
