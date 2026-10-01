import Image from "next/image";
import Link from "next/link";
import { categories } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";
import { site } from "@/lib/site";
import { CartButton, MobileMenu } from "./header-client";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <div className="bg-navy text-white text-xs">
        <div className="container-x flex h-8 items-center justify-between gap-4">
          <span className="truncate">{site.tagline}</span>
          <a href={`tel:${site.phone}`} className="shrink-0 hover:underline">
            Call {site.phoneDisplay}
          </a>
        </div>
      </div>
      <div className="container-x flex h-16 items-center gap-6">
        <MobileMenu categories={categories.map(({ slug, name }) => ({ slug, name }))} signedIn={!!user} />
        <Link href="/" className="shrink-0" aria-label={`${site.name} home`}>
          <Image src="/brand/logo.png" alt={site.name} width={359} height={200} priority className="h-10 w-auto" />
        </Link>
        <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-ink/80">
          <Link href="/shop" className="hover:text-navy">Shop all</Link>
          {categories.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="hover:text-navy whitespace-nowrap">
              {c.name}
            </Link>
          ))}
          <Link href="/contact" className="hover:text-navy">Contact</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/design"
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-magenta/30 px-4 py-2 text-sm font-semibold text-magenta hover:bg-magenta/5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
            Design Studio
          </Link>
          <Link
            href={user ? "/account" : "/signin"}
            className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-mist"
          >
            <UserIcon />
            {user ? `Hi, ${user.name.split(" ")[0]}` : "Sign in"}
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
