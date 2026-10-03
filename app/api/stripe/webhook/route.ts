import { paymentsConfigured, settleSession, stripe } from "@/lib/payments";

// Stripe calls this when a customer pays. The signature proves the call is from Stripe.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!paymentsConfigured() || !secret || !signature) return new Response("Not configured", { status: 400 });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      await settleSession(event.data.object);
    } catch (e) {
      // A non-2xx reply makes Stripe retry the event later.
      console.error("Failed to record Stripe payment", e);
      return new Response("Error", { status: 500 });
    }
  }
  return new Response("ok");
}
