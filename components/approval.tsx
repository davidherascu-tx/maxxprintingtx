import type { Approval, OrderEvent } from "@/lib/db";
import type { DesignSource } from "@/lib/design-config";

const tone: Record<Approval, string> = {
  review: "bg-yellow/30 text-navy",
  artwork_issue: "bg-magenta/15 text-magenta",
  proof_sent: "bg-cyan/15 text-navy",
  changes_requested: "bg-magenta/15 text-magenta",
  approved: "bg-navy text-white",
};

/** What each approval step means to staff. */
export const staffApprovalLabel: Record<Approval, string> = {
  review: "Needs review",
  artwork_issue: "Waiting on customer artwork",
  proof_sent: "Proof sent · waiting for customer",
  changes_requested: "Customer requested changes",
  approved: "Approved",
};

/** The same steps, as the customer sees them. */
export const customerApprovalLabel: Record<Approval, string> = {
  review: "Checking your artwork",
  artwork_issue: "Action needed: artwork",
  proof_sent: "Proof ready · please review",
  changes_requested: "Updating your proof",
  approved: "Proof approved",
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
  artwork_issue: "asked for new artwork",
  artwork_ok: "marked the artwork as received",
  approved_by_staff: "recorded the customer's approval",
  approved: "approved the proof",
  changes_requested: "requested changes",
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
