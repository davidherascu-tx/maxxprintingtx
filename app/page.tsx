import Image from "next/image";
import Link from "next/link";
import { categories, products, productsIn } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { site } from "@/lib/site";

export default function Home() {
  const featured = products.filter((p) => p.featured);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(60rem_30rem_at_90%_-10%,var(--color-cyan),transparent),radial-gradient(40rem_25rem_at_-10%_110%,var(--color-magenta),transparent)]" />
        <div className="container-x relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
              <span className="h-2 w-2 rounded-full bg-yellow" /> Printed in Houston, TX
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Make your brand <span className="text-cyan">impossible</span> to miss.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/75">
              Yard signs, banners, custom apparel, signage and trade show displays — designed, printed and
              ready fast.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/design" className="btn-accent">Design your own</Link>
              <Link href="/shop" className="btn bg-white text-navy hover:bg-mist">Shop products</Link>
              <a href={`tel:${site.phone}`} className="btn border border-white/30 text-white hover:bg-white/10">
                Call {site.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="cmyk-bar absolute -inset-2 rounded-3xl opacity-60 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl shadow-2xl">
              <Image
                src="/products/1000053.png"
                alt="Maxx Marketing yard sign"
                width={500}
                height={397}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
        <div className="cmyk-bar h-1.5" />
      </section>

      {/* Categories */}
      <section className="container-x py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-navy">Shop by category</h2>
            <p className="mt-2 text-ink/60">Everything you need to promote your business, team or event.</p>
          </div>
          <Link href="/shop" className="hidden text-sm font-semibold text-navy hover:underline sm:block">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 sm:gap-6">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-line bg-mist"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="border-t border-line bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-navy">{c.name}</h3>
                  <span className="text-xs text-ink/50">{productsIn(c.slug).length} items</span>
                </div>
                <p className="mt-1 hidden text-sm text-ink/60 sm:block">{c.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-mist">
        <div className="container-x grid gap-6 py-14 sm:grid-cols-3">
          {[
            { color: "bg-cyan", title: "Free artwork review", text: "We check every file and send a proof before anything prints." },
            { color: "bg-magenta", title: "Fast local turnaround", text: "Pick up in Houston or have it delivered to your door." },
            { color: "bg-yellow", title: "One-stop shop", text: "Signs, apparel, stickers and displays — all under one roof." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white p-6">
              <span className={`block h-1.5 w-10 rounded-full ${f.color}`} />
              <h3 className="mt-4 font-semibold text-navy">{f.title}</h3>
              <p className="mt-1 text-sm text-ink/60">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-x py-16">
        <h2 className="mb-8 font-display text-3xl text-navy">Popular products</h2>
        <ProductGrid products={featured} />
      </section>

      {/* CTA */}
      <section className="container-x">
        <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-12 text-center text-white sm:px-12">
          <div className="cmyk-bar absolute inset-x-0 top-0 h-1.5" />
          <h2 className="font-display text-3xl">Need something custom?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Bulk orders, special sizes or a full rebrand — tell us what you need and we&apos;ll put together a quote.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="btn-accent">Get a quote</Link>
            <Link href="/signup" className="btn border border-white/30 text-white hover:bg-white/10">
              Create an account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
