import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { formatPrice } from "./catalog";
import type { Order } from "./db";
import type { Site } from "./site";
import { sendMail } from "./smtp";
import { STEPS, stepsDone } from "./order-steps";
import { getSettings } from "./store";

// Transactional email through our own mail server over SMTP (mail.shotokancenter.com).
// Needs SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD and
// EMAIL_FROM ("Maxx Marketing <maxxprintingtx@shotokancenter.com>"). Without them, emails are
// skipped and logged, so the shop keeps working.
//
// The SMTP client (lib/smtp.ts) uses Cloudflare's sockets on Workers and Node's TLS in `next dev`.
//
// Emails are sent with after(): the page or action finishes first, and a failed email never
// breaks an order. Shop notifications go to "Order notifications" in Admin → Settings.

type Email = { to: string; subject: string; html: string; text: string; replyTo?: string };

function smtpConfig() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: password } = process.env;
  if (!host || !user || !password) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  // Port 465 speaks SSL from the start; other ports (587) upgrade with STARTTLS.
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return { host, port, secure, user, password };
}

/** Whether emails can actually be sent. */
export const emailConfigured = () => smtpConfig() !== null;

/**
 * Whether new accounts must click an activation link before signing in. Off unless
 * REQUIRE_EMAIL_ACTIVATION=true, and only once email is set up: otherwise sign-ups would wait
 * for an email that never arrives.
 */
export const activationRequired = () => process.env.REQUIRE_EMAIL_ACTIVATION === "true" && emailConfigured();

/** "Name <address>" (or just "address"). */
function fromAddress(user: string) {
  const from = (process.env.EMAIL_FROM || user).trim();
  const m = /^(.*)<([^>]+)>$/.exec(from);
  return m ? { name: m[1].trim().replace(/^"|"$/g, "") || undefined, email: m[2].trim() } : { email: from };
}

/** Send one email now. Throws if the server refuses it. */
async function deliver(email: Email) {
  const cfg = smtpConfig();
  if (!cfg) {
    console.warn(`Email skipped (SMTP not set up): "${email.subject}" to ${email.to}`);
    return false;
  }
  await sendMail(cfg, { from: fromAddress(cfg.user), ...email });
  return true;
}

async function send(email: Email) {
  try {
    await deliver(email);
  } catch (e) {
    console.error(`Email failed: "${email.subject}" to ${email.to}:`, e instanceof Error ? e.message : e);
  }
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

/** The 6 order steps as a row of boxes: done ones ticked, the current one highlighted. */
function stepsStrip(o: Pick<Order, "paymentStatus" | "approval" | "status">) {
  const done = stepsDone(o);
  const cells = STEPS.map((s, i) => {
    const style =
      i < done
        ? "background:#02245b;color:#ffffff"
        : i === done
          ? "background:#fff6cc;color:#02245b;border:2px solid #ffd200"
          : "background:#f1f4f9;color:#94a3b8";
    return `<td width="16.6%" style="padding:2px"><div style="${style};border-radius:10px;padding:8px 2px;text-align:center;font-size:11px;font-weight:bold;line-height:1.3">${i < done ? "✔" : i + 1}<br>${esc(s.label)}</div></td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;border-collapse:separate"><tr>${cells}</tr></table>`;
}

function layout(site: Site, o: { heading: string; intro: string; note?: string; noteLabel?: string; order?: Order; step?: Pick<Order, "paymentStatus" | "approval" | "status">; button?: { href: string; label: string } }) {
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
        ${o.step ? stepsStrip(o.step) : ""}
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
  const check = order.approval !== "approved";
  const next = check
    ? "We'll check your design and let you know as soon as it's approved."
    : "We'll start on it and email you when it's being printed.";
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Order ${order.number} received`,
      html: layout(site, {
        heading: `Thanks for your order, ${first(customer.name)}!`,
        intro: `We've received and paid order <b>${esc(order.number)}</b>. ${next}`,
        step: order,
        order,
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Thanks for your order, ${first(customer.name)}!`, `We've received order ${order.number}. ${next}`, `Total: ${formatPrice(order.subtotal + order.tax)}`, `View your order: ${base}/account`]),
    },
    {
      to: notifyEmail,
      replyTo: customer.email,
      subject: `New order ${order.number} · ${formatPrice(order.subtotal + order.tax)}${check ? " · design to check" : ""}`,
      html: layout(site, {
        heading: `New order ${order.number}`,
        intro: `From <b>${esc(customer.name)}</b> (${esc(customer.email)}) · ${order.fulfillment === "pickup" ? "store pickup" : "local delivery"}.${check ? " It has a Design Studio design to check and approve." : " Ready to print."}`,
        note: order.notes || undefined,
        noteLabel: "Customer notes",
        order,
        button: { href: `${base}/admin/orders/${order.number}`, label: "Open in admin" },
      }),
      text: plain(site, [`New order ${order.number} from ${customer.name} (${customer.email}).`, check && "It has a design to check and approve.", order.notes && `Notes: ${order.notes}`, `Open: ${base}/admin/orders/${order.number}`]),
    },
  ]);
}

/** The shop needs the customer to change their design. */
export async function emailArtworkNeeded(order: Order, customer: Customer, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Please check your design for order ${order.number}`,
      html: layout(site, {
        heading: "We need a change to your design",
        intro: `Hi ${esc(first(customer.name))}, before we can print order <b>${esc(order.number)}</b>, please take a look at this. Just reply to this email.`,
        note,
        noteLabel: "What we need",
        step: order,
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, before we can print order ${order.number}, we need a change to your design:`, note, `Reply to this email, or view your order: ${base}/account`]),
    },
  ]);
}

/** One email per step the customer should hear about: design approved, printing, ready, done. */
export async function emailOrderStep(order: Order, customer: Customer, step: "approved" | "printing" | "ready" | "done") {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  const name = esc(first(customer.name));
  const n = esc(order.number);
  const pickup = order.fulfillment === "pickup";
  const where = `${site.address.line1}${site.address.line2 ? `, ${site.address.line2}` : ""}, ${site.address.city}`;
  const content = {
    approved: {
      subject: `Your design for order ${order.number} is approved`,
      heading: "Your design is approved 🎨",
      intro: `Hi ${name}, we checked your design for order <b>${n}</b> and it looks great. It goes to printing next.`,
      text: `Your design for order ${order.number} is approved. It goes to printing next.`,
    },
    printing: {
      subject: `Order ${order.number} is being printed`,
      heading: "Your order is being printed 🖨️",
      intro: `Hi ${name}, order <b>${n}</b> is in production now. We'll email you as soon as it's ready.`,
      text: `Order ${order.number} is being printed. We'll email you when it's ready.`,
    },
    ready: {
      subject: `Order ${order.number} is ready${pickup ? " for pickup" : ""}`,
      heading: pickup ? "Your order is ready for pickup 📦" : "Your order is ready 📦",
      intro: pickup
        ? `Hi ${name}, order <b>${n}</b> is ready. Pick it up at ${esc(where)}.`
        : `Hi ${name}, order <b>${n}</b> is ready. We'll be in touch about delivery.`,
      text: pickup ? `Order ${order.number} is ready for pickup at ${where}.` : `Order ${order.number} is ready. We'll be in touch about delivery.`,
    },
    done: {
      subject: `Order ${order.number} is complete. Thank you!`,
      heading: "All done. Thank you! ✅",
      intro: `Hi ${name}, order <b>${n}</b> is complete. Thanks for choosing ${esc(site.name)}. We'd love to print for you again!`,
      text: `Order ${order.number} is complete. Thank you for choosing ${site.name}!`,
    },
  }[step];
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: content.subject,
      html: layout(site, { heading: content.heading, intro: content.intro, step: order, button: { href: `${base}/account`, label: "View your order" } }),
      text: plain(site, [`Hi ${first(customer.name)},`, content.text, `View your order: ${base}/account`]),
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

/** Admin → Settings "Send test email": sends right away and reports what the mail server said. */
export async function sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up: SMTP_HOST, SMTP_USER and SMTP_PASSWORD are missing." };
  const { site } = await getSettings();
  try {
    await deliver({
      to,
      subject: `Test email from ${site.name}`,
      html: layout(site, {
        heading: "Your email is working",
        intro: "This test was sent by the website through your own mail server. Order and account emails will look like this.",
      }),
      text: plain(site, ["Your email is working.", "This test was sent by the website through your own mail server."]),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** "Forgot password": the link to choose a new password. */
export async function emailPasswordReset(customer: Customer, link: string) {
  const { site, notifyEmail } = await getSettings();
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Reset your ${site.name} password`,
      html: layout(site, {
        heading: "Reset your password",
        intro: `Hi ${esc(first(customer.name))}, click the button to choose a new password. The link works for 1 hour and only once.`,
        button: { href: link, label: "Choose a new password" },
        note: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
      }),
      text: plain(site, [`Hi ${first(customer.name)}, choose a new password here (the link works for 1 hour and only once):`, link, "", "If you didn't ask for this, ignore this email. Your password stays the same."]),
    },
  ]);
}

/** A customer asked for a refund: tell the shop, and confirm to the customer. */
export async function emailRefundRequested(order: Order, customer: Customer, reason: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  const total = formatPrice(order.subtotal + order.tax);
  queue([
    {
      to: notifyEmail,
      replyTo: customer.email,
      subject: `Refund request for ${order.number} (${total})`,
      html: layout(site, {
        heading: `${customer.name} asked for a refund`,
        intro: `Order <b>${esc(order.number)}</b> · ${total}. Approve or decline it in the admin.`,
        note: reason,
        noteLabel: "Their reason",
        button: { href: `${base}/admin/orders/${order.number}`, label: "Open in admin" },
      }),
      text: plain(site, [`${customer.name} asked for a refund on order ${order.number} (${total}).`, `Reason: ${reason}`, `Open: ${base}/admin/orders/${order.number}`]),
    },
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `We got your refund request for ${order.number}`,
      html: layout(site, {
        heading: "We got your refund request",
        intro: `Hi ${esc(first(customer.name))}, thanks for letting us know. We'll look at order <b>${esc(order.number)}</b> and get back to you soon, usually within 1 to 2 business days.`,
        note: reason,
        noteLabel: "What you told us",
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, we got your refund request for order ${order.number}. We'll get back to you within 1 to 2 business days.`]),
    },
  ]);
}

/** Money is on its way back (or was given back in person). */
export async function emailRefunded(order: Order, customer: Customer, amount: number, byCard: boolean, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  const how = byCard
    ? "It goes back to the card you paid with and usually shows up in 5 to 10 business days."
    : "We'll give it back to you the same way you paid.";
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `Refund of ${formatPrice(amount)} for order ${order.number}`,
      html: layout(site, {
        heading: `We refunded ${formatPrice(amount)}`,
        intro: `Hi ${esc(first(customer.name))}, we've refunded <b>${formatPrice(amount)}</b> for order <b>${esc(order.number)}</b>. ${how}`,
        note: note || undefined,
        noteLabel: "A note from our team",
        button: { href: `${base}/account/orders/${order.number}/invoice`, label: "See your updated invoice" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, we've refunded ${formatPrice(amount)} for order ${order.number}. ${how}`, note && `Note: ${note}`]),
    },
  ]);
}

export async function emailRefundDeclined(order: Order, customer: Customer, note: string) {
  const { site, notifyEmail } = await getSettings();
  const base = await origin(site);
  queue([
    {
      to: customer.email,
      replyTo: notifyEmail,
      subject: `About your refund request for ${order.number}`,
      html: layout(site, {
        heading: "About your refund request",
        intro: `Hi ${esc(first(customer.name))}, we looked at your request for order <b>${esc(order.number)}</b> and can't offer a refund this time. Questions? Just reply to this email.`,
        note,
        noteLabel: "Why",
        button: { href: `${base}/account`, label: "View your order" },
      }),
      text: plain(site, [`Hi ${first(customer.name)}, we can't offer a refund for order ${order.number} this time.`, `Why: ${note}`, "Questions? Just reply to this email."]),
    },
  ]);
}
