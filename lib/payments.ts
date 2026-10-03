import "server-only";
import Stripe from "stripe";
import { findOrder, markOrderPaid, setOrderSession, type Order } from "./db";
import { TAX_LABEL } from "./tax";

// Card payments through Stripe Checkout (hosted page). Needs STRIPE_SECRET_KEY, and
// STRIPE_WEBHOOK_SECRET for the webhook at /api/stripe/webhook.

export const paymentsConfigured = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | undefined;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY must be set");
  return (client ??= new Stripe(key));
}

const cents = (n: number) => Math.round(n * 100);

/** Create a Checkout Session for an unpaid order and return the page to send the customer to. */
export async function startCheckout(order: Order, email: string, origin: string) {
  const currency = "usd";
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    customer_email: email,
    line_items: [
      ...order.items.map((i) => {
        const description = [i.color, i.variant].filter(Boolean).join(" · ");
        return {
          quantity: i.qty,
          price_data: {
            currency,
            unit_amount: cents(i.price),
            product_data: { name: i.name, ...(description && { description }) },
          },
        };
      }),
      ...(order.tax > 0
        ? [{ quantity: 1, price_data: { currency, unit_amount: cents(order.tax), product_data: { name: `Sales tax (${TAX_LABEL})` } } }]
        : []),
    ],
    metadata: { order_id: order.id, order_number: order.number },
    payment_intent_data: { description: `Order ${order.number}`, metadata: { order_id: order.id, order_number: order.number } },
    success_url: `${origin}/account?order=${order.number}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?cancelled=${order.number}`,
    // The shortest lifetime Stripe allows; an abandoned checkout is replaced by the next one.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await setOrderSession(order.id, session.id);
  return session.url;
}

/** Mark the order behind a paid Checkout Session as paid. Returns the order id if it is now paid. */
export async function settleSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId || session.payment_status !== "paid" || session.amount_total === null) return null;
  const paid = await markOrderPaid(orderId, session.id, session.amount_total);
  if (!paid) console.error("Stripe payment could not be matched to an unpaid order", orderId, session.id);
  return paid ? orderId : null;
}

/** On return from Stripe: confirm the payment directly, in case the webhook has not arrived yet. */
export async function confirmCheckoutSession(sessionId: string, userId: string) {
  if (!paymentsConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const order = session.metadata?.order_id ? await findOrder(session.metadata.order_id) : undefined;
    if (order && order.userId === userId) await settleSession(session);
  } catch (e) {
    console.error("Could not confirm checkout session", e);
  }
}

/**
 * Close an unfinished Checkout Session. Returns false if it was already paid, in which case
 * the order must be kept.
 */
export async function expireSession(sessionId: string) {
  const s = stripe();
  const session = await s.checkout.sessions.retrieve(sessionId);
  if (session.status === "complete") return false;
  if (session.status === "open") await s.checkout.sessions.expire(sessionId);
  return true;
}
