import type { Metadata } from "next";
import { mapsUrl, site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  const cards = [
    {
      title: "Visit us",
      body: (
        <>
          {site.address.line1}, {site.address.line2}
          <br />
          {site.address.city}, {site.address.state} {site.address.zip}
        </>
      ),
      href: mapsUrl,
      cta: "Get directions",
      color: "bg-cyan",
    },
    { title: "Call us", body: site.phoneDisplay, href: `tel:${site.phone}`, cta: "Call now", color: "bg-magenta" },
    { title: "Email us", body: site.email, href: `mailto:${site.email}`, cta: "Send an email", color: "bg-yellow" },
  ];

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Contact us</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Questions, bulk orders or custom projects? Reach out and we&apos;ll get back to you with a quote.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group rounded-2xl border border-line p-6 transition hover:shadow-xl hover:shadow-navy/5"
          >
            <span className={`block h-1.5 w-10 rounded-full ${c.color}`} />
            <h2 className="mt-4 font-semibold text-navy">{c.title}</h2>
            <p className="mt-2 break-words text-ink/70">{c.body}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-navy group-hover:underline">{c.cta} →</span>
          </a>
        ))}
      </div>
      <div className="mt-10 overflow-hidden rounded-2xl border border-line">
        <iframe
          title="Map to Maxx Marketing Agency"
          src={`https://www.google.com/maps?q=${encodeURIComponent(
            `${site.address.line1} ${site.address.line2}, ${site.address.city}, ${site.address.state} ${site.address.zip}`,
          )}&output=embed`}
          className="h-80 w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}
