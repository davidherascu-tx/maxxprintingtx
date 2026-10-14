import type { Approval, OrderEvent } from "@/lib/db";
import type { DesignSource } from "@/lib/design-config";

const tone: Record<Approval, string> = {
  review: "bg-yellow/30 text-navy",
  artwork_issue: "bg-magenta/15 text-magenta",
  proof_sent: "bg-yellow/30 text-navy",
  changes_requested: "bg-yellow/30 text-navy",
  approved: "bg-navy text-white",
};

/** What each approval step means to staff. */
export const staffApprovalLabel: Record<Approval, string> = {
  review: "Design to check",
  artwork_issue: "Waiting on customer",
  proof_sent: "Design to check",
  changes_requested: "Design to check",
  approved: "Design approved",
};

/** The same steps, as the customer sees them. */
export const customerApprovalLabel: Record<Approval, string> = {
  review: "We're checking your design",
  artwork_issue: "Action needed: your design",
  proof_sent: "We're checking your design",
  changes_requested: "We're checking your design",
  approved: "Design approved",
};

export function ApprovalBadge({ approval, customer }: { approval: Approval; customer?: boolean }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[approval]}`}>
      {(customer ? customerApprovalLabel : staffApprovalLabel)[approval]}
    </span>
  );
}

export const sourceLabel: Record<DesignSource, string> = {
  studio: "Design Studio",
  dtf: "DTF gang sheet",
  none: "No design · artwork to follow",
};

export function SourceBadge({ source }: { source: DesignSource }) {
  const color = source === "studio" ? "border-magenta/40 text-magenta" : source === "dtf" ? "border-cyan text-navy" : "border-line text-ink/60";
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>{sourceLabel[source]}</span>;
}

const eventText: Record<OrderEvent["kind"], string> = {
  proof_sent: "sent a proof",
  artwork_issue: "asked the customer to change the design",
  artwork_ok: "marked the new design as received",
  approved_by_staff: "approved the design",
  approved: "approved the proof",
  changes_requested: "requested changes",
  refund_requested: "asked for a refund",
  refunded: "refunded",
  refund_declined: "declined the refund request",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" });

/** The approval history of one order, newest first. Staff names are only shown to staff. */
export function ApprovalHistory({ events, orderId, forCustomer }: { events: OrderEvent[]; orderId: string; forCustomer?: boolean }) {
  if (events.length === 0) return null;
  return (
    <ol className="space-y-3">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="border-l-2 border-line pl-3 text-sm">
          <p className="text-ink/60">
            <span className="font-medium text-ink">{e.actor === "customer" ? (forCustomer ? "You" : e.actorName) : forCustomer ? "Our team" : e.actorName}</span>{" "}
            {eventText[e.kind]} · {when(e.at)}
          </p>
          {e.note && <p className="mt-1 whitespace-pre-wrap">{e.note}</p>}
          {e.image && (
            <a href={`/api/orders/${orderId}/proof/${e.image}`} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- proof image served by our API */}
              <img src={`/api/orders/${orderId}/proof/${e.image}`} alt="Proof" className="max-h-64 rounded-lg border border-line bg-mist object-contain" />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
