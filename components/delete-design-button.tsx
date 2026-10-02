"use client";

import { useTransition } from "react";
import { removeDesign } from "@/lib/actions";
import { useCart } from "./cart";

export function DeleteDesignButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const { lines, remove } = useCart();

  const onClick = () => {
    if (!confirm("Delete this design? This can't be undone.")) return;
    startTransition(async () => {
      const result = await removeDesign(id);
      if (result?.error) return alert(result.error);
      // Don't leave a deleted design sitting in the cart.
      lines.filter((l) => l.designId === id).forEach(remove);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-sm font-semibold text-magenta hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
