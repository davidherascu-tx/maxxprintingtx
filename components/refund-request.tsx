"use client";

import { useActionState, useState } from "react";
import { requestRefundAction } from "@/lib/actions";
import { useStoreSettings } from "./store";

/** "Request a refund" on an order in My account: shows the policy, then asks why. */
export function RefundRequest({ orderId }: { orderId: string }) {
  const { returnPolicy } = useStoreSettings();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(requestRefundAction, undefined);

  if (state?.ok) return <p className="mt-3 rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-ink/60 underline hover:text-magenta">
        Problem with this order? Request a refund
      </button>
    );
  }
  return (
    <form action={action} className="mt-4 space-y-3 rounded-xl border border-line bg-mist/60 p-4">
      <input type="hidden" name="id" value={orderId} />
      <p className="font-semibold text-navy">Request a refund</p>
      <p className="text-xs leading-relaxed text-ink/60">{returnPolicy}</p>
      <div>
        <label htmlFor={`reason-${orderId}`} className="label">What went wrong?</label>
        <textarea id={`reason-${orderId}`} name="reason" rows={3} required minLength={10} className="field" placeholder="e.g. The logo printed blurry on 3 of the shirts." />
      </div>
      {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send request"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline">Cancel</button>
      </div>
    </form>
  );
}
