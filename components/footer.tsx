import Image from "next/image";
import Link from "next/link";
import { categories } from "@/lib/catalog";
import { mapsUrl, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 bg-navy-900 text-white/80">
      <div className="cmyk-bar h-1.5" />
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Image src="/brand/logo-white.png" alt={site.name} width={359} height={200} className="h-14 w-auto" />
          <p className="mt-4 text-sm leading-relaxed">
            Houston&apos;s one-stop shop for printing, apparel and marketing products.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Shop</h3>
          <ul className="space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-white">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Account</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/signin" className="hover:text-white">Sign in</Link></li>
            <li><Link href="/signup" className="hover:text-white">Create account</Link></li>
            <li><Link href="/account" className="hover:text-white">Order history</Link></li>
            <li><Link href="/cart" className="hover:text-white">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Contact Us</h3>
          <address className="space-y-2 text-sm not-italic">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="block hover:text-white">
              {site.address.line1}<br />
              {site.address.line2}<br />
              {site.address.city}, {site.address.state} {site.address.zip}
            </a>
            <a href={`tel:${site.phone}`} className="block hover:text-white">{site.phoneDisplay}</a>
            <a href={`mailto:${site.email}`} className="block hover:text-white">{site.email}</a>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {site.legalName}. All rights reserved.</span>
          <span>Houston, Texas</span>
        </div>
      </div>
    </footer>
  );
}
