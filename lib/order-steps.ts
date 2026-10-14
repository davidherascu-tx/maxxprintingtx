import type { Order } from "./db";

/** The six steps every order goes through, in order. */
export const STEPS = [
  { label: "Paid", icon: "💳" },
  { label: "Design check", icon: "🎨" },
  { label: "Approved", icon: "👍" },
  { label: "Printing", icon: "🖨️" },
  { label: "Ready", icon: "📦" },
  { label: "Done", icon: "✅" },
] as const;

type O = Pick<Order, "paymentStatus" | "approval" | "status"> & Partial<Pick<Order, "refundStatus">>;

/**
 * How many steps are finished (0 = not even paid, 6 = done). The step after them is the current
 * one: while an order is printing, "Printing" is current (not finished) until it's Ready.
 */
export function stepsDone(o: O) {
  if (o.paymentStatus === "unpaid") return 0;
  if (o.status === "Completed") return 6;
  if (o.status === "Ready") return 5;
  if (o.approval === "approved") return 3; // to print, or printing now
  return 1;
}

/** What happens next, in plain words, and whether it's staff's turn. */
export function nextStep(o: O): { text: string; icon: string; yourTurn: boolean } {
  if (o.refundStatus === "requested") return { text: "The customer asked for a refund: refund it or decline", icon: "↩️", yourTurn: true };
  if (o.refundStatus === "refunded") return { text: "Refunded in full", icon: "↩️", yourTurn: false };
  if (o.paymentStatus === "unpaid") return { text: "Waiting for the customer to pay", icon: "💳", yourTurn: false };
  if (o.status === "Completed") return { text: "All done", icon: "✅", yourTurn: false };
  if (o.status === "Ready") return { text: "Give it to the customer, then press Done", icon: "📦", yourTurn: true };
  if (o.status === "In production") return { text: "When it's finished, press Ready", icon: "⚙️", yourTurn: true };
  switch (o.approval) {
    case "approved":
      return { text: "Print it, then press Start printing", icon: "🖨️", yourTurn: true };
    case "review":
    case "proof_sent":
    case "changes_requested":
      return { text: "Look at the customer's design, then press Approve design", icon: "🎨", yourTurn: true };
    case "artwork_issue":
      return { text: "Waiting for the customer to change their design", icon: "⏳", yourTurn: false };
  }
}
