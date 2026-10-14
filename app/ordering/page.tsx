import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/store";
import { taxLabel } from "@/lib/tax";

export const metadata: Metadata = {
  title: "Ordering & delivery",
  description: "How ordering works: payment, design check, store pickup and delivery costs.",
};

const steps = [
  {
    title: "Order & pay",
    text: "Add products to your cart and check out. You pay securely by credit or debit card, and sales tax is added at checkout.",
    color: "bg-cyan",
  },
  {
    title: "We check your design",
    text: "If you made your design in our Design Studio, our team checks it before printing. If something needs a change, we email you.",
    color: "bg-magenta",
  },
  {
    title: "Delivery quote",
    text: "If you chose local delivery, we email you the delivery cost and invoice it separately.",
    color: "bg-yellow",
  },
  {
    title: "We print",
    text: "We email you when your order is being printed and again when it's ready. Pick up in store or get it delivered.",
    color: "bg-navy",
  },
];

const faqTemplate = [
  {
    q: "When do I pay?",
    a: "At checkout, by credit or debit card. After that we email you at every step: design approved, printing, ready and done.",
  },
  {
    q: "Is my card information safe?",
    a: "Yes. Payment is handled by Stripe on its own secure page. Your card number never reaches our website. You can also pay in person at our store.",
  },
  {
    q: "How much does delivery cost?",
    a: "It depends on the delivery address and the size of your order. We'll email you the exact amount and invoice it separately. You can switch to free store pickup at any time.",
  },
  {
    q: "Is sales tax included in the prices on the website?",
    a: "No. Prices on the website don't include tax. Sales tax (TAX%) is added at checkout.",
  },
  {
    q: "Can I return my order or get a refund?",
    a: "POLICY Ask in your account: open the order and press \"Request a refund\".",
  },
  {
    q: "Can I change my order after placing it?",
    a: "Yes. Contact us before we start printing and we'll update the order.",
  },
  {
    q: "Do you ship outside the Houston area?",
    a: "Contact us with your address and we'll let you know the options and the cost.",
  },
];

export default async function OrderingPage() {
  const { site, taxRate, returnPolicy } = await getSettings();
  const tax = taxLabel(taxRate);
  const faqs = faqTemplate.map((f) => ({ ...f, a: f.a.replace("TAX%", tax).replace("POLICY", returnPolicy) }));
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Ordering & delivery</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Every print job is checked by our team before anything is charged. Here&apos;s how it works, from your order to
        your door.
      </p>

      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line p-6">
            <span className={`block h-1.5 w-10 rounded-full ${s.color}`} />
            <p className="mt-4 text-sm font-semibold text-ink/50">Step {i + 1}</p>
            <h2 className="mt-1 font-semibold text-navy">{s.title}</h2>
            <p className="mt-2 text-sm text-ink/70">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-mist p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-navy">What you pay at checkout</h2>
          <p className="mt-2 text-ink/70">Your order total at checkout shows:</p>
          <ul className="mt-4 space-y-2 text-sm text-ink/80">
            <li className="flex gap-2"><span className="text-magenta">●</span> Your products, quantities and prices</li>
            <li className="flex gap-2"><span className="text-magenta">●</span> Texas sales tax ({tax})</li>
            <li className="flex gap-2"><span className="text-magenta">●</span> The final total, paid securely by card</li>
          </ul>
          <p className="mt-4 text-sm text-ink/60">Local delivery, if you choose it, is quoted and invoiced separately.</p>
        </section>

        <section className="rounded-2xl bg-mist p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-navy">Pickup & delivery</h2>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-medium">Store pickup: free</h3>
              <p className="mt-1 text-sm text-ink/70">
                Pick up at {site.address.line1}, {site.address.line2}, {site.address.city}. We&apos;ll let you know when
                your order is ready.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Local delivery: quoted separately</h3>
              <p className="mt-1 text-sm text-ink/70">
                The cost depends on the delivery address and the size of your order. We&apos;ll email you the exact amount
                and invoice it separately.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Outside Houston</h3>
              <p className="mt-1 text-sm text-ink/70">Contact us and we&apos;ll quote shipping to your address.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-navy">Questions</h2>
        <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-xl text-ink/40 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink/70">
          Still have questions? Call <a href={`tel:${site.phone}`} className="font-semibold text-navy hover:underline">{site.phoneDisplay}</a> or
          email <a href={`mailto:${site.email}`} className="font-semibold text-navy hover:underline">{site.email}</a>.
        </p>
        <Link href="/shop" className="btn-primary shrink-0">Start shopping</Link>
      </div>
    </div>
  );
}
