"use client";

/** Opens the browser's print dialog (where "Save as PDF" is also offered). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
      {label}
    </button>
  );
}
