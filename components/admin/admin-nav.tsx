"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Home", icon: "🏠" },
  { href: "/admin/orders", label: "Orders", icon: "📦" },
  { href: "/admin/products", label: "Products & prices", icon: "🏷️" },
  { href: "/admin/design-areas", label: "Design studio", icon: "🎨" },
  { href: "/admin/customers", label: "Customers", icon: "👥" },
  { href: "/admin/staff", label: "Staff", icon: "🧑‍💼" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

/** The admin menu: big buttons with an icon, and a badge on Orders when something needs doing. */
export function AdminNav({ todo }: { todo: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav aria-label="Admin" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-base font-semibold transition ${
            active(l.href) ? "bg-navy text-white shadow" : "bg-white text-navy ring-1 ring-line hover:bg-mist"
          }`}
        >
          <span aria-hidden className="text-xl">{l.icon}</span>
          <span className="flex-1">{l.label}</span>
          {l.href === "/admin/orders" && todo > 0 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-magenta px-1.5 text-xs font-bold text-white" aria-label={`${todo} to do`}>
              {todo}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
