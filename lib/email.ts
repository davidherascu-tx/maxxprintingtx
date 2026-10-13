import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { formatPrice } from "./catalog";
import type { Order } from "./db";
import type { Site } from "./site";
import { getSettings } from "./store";

// Transactional email through Resend (https://resend.com), called over its HTTP API so it
// works on Cloudflare Workers. Needs RESEND_API_KEY, and EMAIL_FROM with an address on a
// domain verified in Resend (e.g. "Maxx Marketing <orders@maxxprintingtx.com>"). Without a
// key, emails are skipped and logged, so the shop keeps working.
//
// Emails are sent with after(): the page or action finishes first, and a failed email never
// breaks an order. Shop notifications go to "Order notifications" in Admin → Settings.

type Email = { to: string; subject: string; html: string; text: string; replyTo?: string };

/** Whether emails can actually be sent. */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/**
 * Whether new accounts must click an activation link before signing in. Off unless
 * REQUIRE_EMAIL_ACTIVATION=true, and only once email can reach customers (a verified sending
 * domain): otherwise sign-ups would wait for an email that never arrives.
 */
export const activationRequired = () => process.env.REQUIRE_EMAIL_ACTIVATION === "true" && emailConfigured();

async function send(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`Email skipped (RESEND_API_KEY not set): "${email.subject}" to ${email.to}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Maxx Marketing <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo && { reply_to: email.replyTo }),
    }),
  });
  if (!res.ok) console.error(`Email failed (${res.status}): "${email.subject}" to ${email.to}:`, await res.text());
}

/** Send once the response is done; errors are logged, never thrown. */
function queue(emails: Email[]) {
  after(async () => {
    await Promise.all(emails.map((e) => send(e).catch((err) => console.error("Email error:", err))));
  });
}

/** This request's site address (so links work locally too), else the one in settings. */
export async function origin(site: Site) {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {}
  return site.url.replace(/\/$/, "");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paragraphs = (s: string) => esc(s).replace(/\n/g, "<br>");

function layout(site: Site, o: { heading: string; intro: string; note?: string; noteLabel?: string; order?: Order; button?: { href: string; label: string } }) {
  const items = o.order
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:14px">
        ${o.order.items
          .map(
            (i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #e3e8f0">${esc(i.name)}<br><span style="color:#64748b">${esc([i.color, i.variant].filter(Boolean).join(" · "))} × ${i.qty}</span></td>
              <td style="padding:6px 0;border-bottom:1px solid #e3e8f0;text-align:right;white-space:nowrap">${formatPrice(i.price * i.qty)}</td></tr>`,
          )
          .join("")}
        <tr><td style="padding:8px 0;color:#64748b">Tax</td><td style="padding:8px 0;text-align:right">${formatPrice(o.order.tax)}</td></tr>
        <tr><td style="padding:0;font-weight:bold;color:#02245b">Total</td><td style="padding:0;text-align:right;font-weight:bold;color:#02245b">${formatPrice(o.order.subtotal + o.order.tax)}</td></tr>
      </table>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f1f4f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#02245b;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${esc(site.name)}</td></tr>
      <tr><td style="height:4px;background:linear-gradient(90deg,#00aeef 0 33%,#ec008c 33% 66%,#ffd200 66% 100%)"></td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:22px;color:#02245b">${esc(o.heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.5">${o.intro}</p>
        ${o.note ? `<div style="margin:16px 0;padding:12px 14px;background:#f1f4f9;border-radius:10px;font-size:14px;line-height:1.5">${o.noteLabel ? `<b>${esc(o.noteLabel)}</b><br>` : ""}${paragraphs(o.note)}</div>` : ""}
        ${items}
        ${o.button ? `<p style="margin:24px 0 8px"><a href="${esc(o.button.href)}" style="display:inline-block;background:#02245b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(o.button.label)}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:16px 24px;background:#f1f4f9;font-size:12px;color:#64748b;line-height:1.5">
        ${esc(site.legalName)} · ${esc(site.address.line1)}${site.address.line2 ? `, ${esc(site.address.line2)}` : ""}, ${esc(site.address.city)}, ${esc(site.address.state)} ${esc(site.address.zip)}<br>
        ${esc(site.phoneDisplay)} · ${esc(site.email)}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  return html;
}

/** Plain-text version for mail apps that don't show HTML. */
function plain(site: Site, lines: (string | undefined | false)[]) {
  return [...lines.filter(Boolean), "", `${site.name} · ${site.phoneDisplay} · ${site.email}`].join("\n");
}

type Customer = { name: string; email: string };
const first = (name: string) => name.split(" ")[0];

/** A new order was paid (or recorded as paid/invoiced): thank the customer, tell the shop. */
export async function emailOrderPlaced(order: Order, customer: Customer) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Order ${order.number} received`,
      html: layout(site, {
        heading: `Thanks for your order, ${first(customer.name)}!`,
        intro: `We've received order <b>${esc(order.number)}</b>. Our team will check your artwork and send you a proof. Nothing prints until you approve it.`,
        order,
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Thanks for your order, ${first(customer.name)}!`, `We've received order ${order.number}. We'll check your artwork and send you a proof. Nothing prints until you approve it.`, `Total: ${formatPrice(order.subtotal + order.tax)}`, `View your order: ${base}/account`]),
    },
    {
      to: notifyEmail,
      replyTo: customer.email,
      subject: `New order ${order.number} · ${formatPrice(order.subtotal + order.tax)}`,
      html: layout(site, {
        heading: `New order ${order.number}`,
        intro: `From <b>${esc(customer.name)}</b> (${esc(customer.email)}) · ${order.fulfillment === "pickup" ? "store pickup" : "local delivery"}.`,
        note: order.notes || undefined,
        noteLabel: "Customer notes",
        order,
        button: { href: `${base}/admin/orders/${order.number}`, label: "Open in admin" },
      }),
      text: plain(site, [`New order ${order.number} from ${customer.name} (${customer.email}).`, order.notes && `Notes: ${order.notes}`, `Open: ${base}/admin/orders/${order.number}`]),
    },
  ]);
}

export async function emailProofReady(order: Order, customer: Customer, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Your proof for order ${order.number} is ready`,
      html: layout(site, {
        heading: "Your proof is ready to review",
        intro: `Hi ${esc(first(customer.name))}, please check the proof for order <b>${esc(order.number)}</b>: text, spelling, colors and placement. Approve it or tell us what to change in your account.`,
        note: note || undefined,
        noteLabel: "A note from our team",
        button: { href: `${base}/account`, label: "Review your proof" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, your proof for order ${order.number} is ready.`, note && `Note from our team: ${note}`, `Review and approve it: ${base}/account`]),
    },
  ]);
}

export async function emailArtworkNeeded(order: Order, customer: Customer, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `We need something for order ${order.number}`,
      html: layout(site, {
        heading: "We need something from you",
        intro: `Hi ${esc(first(customer.name))}, before we can make your proof for order <b>${esc(order.number)}</b>, we need the following. Just reply to this email.`,
        note,
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, we need something for order ${order.number}:`, note, `Reply to this email, or view your order: ${base}/account`]),
    },
  ]);
}

/** The customer answered a proof: tell the shop. */
export async function emailProofAnswer(order: Order, customer: Customer, approved: boolean, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  const what = approved ? "approved the proof" : "requested changes";
  queue([
    {
      to: notifyEmail,
      replyTo: customer.email,
      subject: `${order.number}: ${customer.name} ${what}`,
      html: layout(site, {
        heading: `${customer.name} ${what}`,
        intro: approved
          ? `Order <b>${esc(order.number)}</b> is approved and can go to production.`
          : `Order <b>${esc(order.number)}</b> needs an updated proof.`,
        note: note || undefined,
        noteLabel: "What they want changed",
        button: { href: `${base}/admin/orders/${order.number}`, label: "Open in admin" },
      }),
      text: plain(site, [`${customer.name} ${what} for order ${order.number}.`, note && `Changes: ${note}`, `Open: ${base}/admin/orders/${order.number}`]),
    },
  ]);
}

export async function emailOrderReady(order: Order, customer: Customer) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  const pickup = order.fulfillment === "pickup";
  const where = `${site.address.line1}${site.address.line2 ? `, ${site.address.line2}` : ""}, ${site.address.city}`;
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Order ${order.number} is ready${pickup ? " for pickup" : ""}`,
      html: layout(site, {
        heading: pickup ? "Your order is ready for pickup" : "Your order is ready",
        intro: pickup
          ? `Hi ${esc(first(customer.name))}, order <b>${esc(order.number)}</b> is ready. Pick it up at ${esc(where)}.`
          : `Hi ${esc(first(customer.name))}, order <b>${esc(order.number)}</b> is ready. We'll be in touch about delivery.`,
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [pickup ? `Order ${order.number} is ready for pickup at ${where}.` : `Order ${order.number} is ready. We'll be in touch about delivery.`]),
    },
  ]);
}

/** The account activation email, with the one link that activates the account. */
export async function emailActivateAccount(customer: Customer, link: string) {
  const { site, notifyEmail } = await getSettings();
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Activate your ${site.name} account`,
      html: layout(site, {
        heading: `Welcome, ${first(customer.name)}!`,
        intro: "Please confirm your email address to activate your account. The link works for 48 hours.",
        button: { href: link, label: "Activate my account" },
        note: "If you didn't create this account, you can ignore this email.",
      }),
      text: plain(site, [`Welcome, ${first(customer.name)}!`, "Confirm your email address to activate your account (the link works for 48 hours):", link, "", "If you didn't create this account, you can ignore this email."]),
    },
  ]);
}
