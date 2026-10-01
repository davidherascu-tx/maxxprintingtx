import Link from "next/link";
import { categories } from "@/lib/catalog";

export function CategoryPills({ active }: { active?: string }) {
  const pill = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
      on ? "border-navy bg-navy text-white" : "border-line text-ink/70 hover:border-navy/40"
    }`;
  return (
    <div className="-mx-4 my-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href="/shop" className={pill(!active)}>All</Link>
      {categories.map((c) => (
        <Link key={c.slug} href={`/category/${c.slug}`} className={pill(active === c.slug)}>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
