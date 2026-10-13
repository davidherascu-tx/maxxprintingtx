"use client";

import { useActionState, useState } from "react";
import { approveProof, requestProofChanges } from "@/lib/actions";

/** The customer's answer to a proof: approve it, or say what to change. */
export function ProofReview({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState(requestProofChanges, undefined);

  if (state?.ok) return <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>;

  return (
    <div className="space-y-3">
      {!changing && (
        <div className="flex flex-wrap gap-2">
          <form
            action={approveProof}
            onSubmit={(e) => {
              if (!window.confirm(`Approve the proof for ${orderNumber}? We'll start printing it as shown.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={orderId} />
            <button type="submit" className="btn-primary">Approve proof</button>
          </form>
          <button type="button" onClick={() => setChanging(true)} className="btn-outline">Request changes</button>
        </div>
      )}
      {changing && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={orderId} />
          <label htmlFor={`changes-${orderId}`} className="label">What should we change?</label>
          <textarea id={`changes-${orderId}`} name="note" rows={3} required className="field" placeholder="e.g. Make the logo bigger and use the darker blue." />
          {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Sending…" : "Send changes"}</button>
            <button type="button" onClick={() => setChanging(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
