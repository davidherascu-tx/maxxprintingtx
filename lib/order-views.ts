import type { Approval, Order, PaymentFilter } from "./db";

/**
 * Ready-made order lists for the admin: one per next step, so staff pick "To print" instead of
 * combining filters. Shared by the home page's to-do cards and the Orders page tabs.
 */
export type OrderView = {
  key: string;
  label: string;
  icon: string;
  /** What to do with these orders, in plain words. */
  hint: string;
  approval?: Approval | Approval[];
  status?: Order["status"];
  payment?: PaymentFilter;
  open?: boolean;
  refund?: "requested";
};

export const ORDER_VIEWS: OrderView[] = [
  { key: "open", label: "Still open", icon: "📂", hint: "Every paid or invoiced order that isn't completed yet, whatever step it's on.", open: true },
  { key: "check", label: "Check design", icon: "🎨", hint: "Orders made in the Design Studio. Look at the design and approve it.", approval: ["review", "proof_sent", "changes_requested"], open: true },
  { key: "waiting", label: "Waiting on customer", icon: "⏳", hint: "You asked the customer to change their design. Nothing to do until they do.", approval: "artwork_issue", open: true },
  { key: "print", label: "To print", icon: "🖨️", hint: "Paid and ready. Print these, then press Start printing.", approval: "approved", status: "Received" },
  { key: "printing", label: "Printing", icon: "⚙️", hint: "Being made. Press Ready when finished.", status: "In production" },
  { key: "ready", label: "Ready", icon: "📦", hint: "Done and waiting for pickup or delivery.", status: "Ready" },
  { key: "done", label: "Done", icon: "✅", hint: "Picked up or delivered.", status: "Completed" },
  { key: "refunds", label: "Refund requests", icon: "↩️", hint: "Customers asking for money back. Open each one and refund it or decline.", refund: "requested" },
  { key: "all", label: "All orders", icon: "📋", hint: "Every paid or invoiced order." },
  { key: "unpaid", label: "Not paid yet", icon: "💳", hint: "Customers who started checkout but didn't pay. Usually nothing to do.", payment: "unpaid" },
];

export const orderView = (key?: string) => ORDER_VIEWS.find((v) => v.key === key);
