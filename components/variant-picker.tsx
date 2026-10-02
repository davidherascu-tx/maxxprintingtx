"use client";

import type { Product } from "@/lib/catalog";

type Props = {
  product: Pick<Product, "variants" | "variantLabel" | "optionLabel">;
  value: string;
  onChange: (id: string) => void;
  /** Smaller buttons, for the Design Studio sidebar. */
  compact?: boolean;
};

/**
 * Option buttons for a product. Variants with a `group` (e.g. size) get two rows:
 * the groups, then the options inside the chosen group (e.g. pack). Hidden when
 * there's only one choice.
 */
export function VariantPicker({ product, value, onChange, compact }: Props) {
  const { variants } = product;
  if (variants.length < 2) return null;
  const current = variants.find((v) => v.id === value) ?? variants[0];

  const button = (active: boolean) =>
    `${compact ? "rounded-lg px-3 py-1.5" : "rounded-xl px-4 py-2 font-medium"} border text-sm transition ${
      active ? "border-navy bg-navy text-white" : "border-line hover:border-navy/40"
    }`;
  const row = (label: string, items: { id: string; label: string; active: boolean; pick: () => void }[]) => (
    <fieldset className={compact ? "" : "mt-6"}>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i.id} type="button" onClick={i.pick} aria-pressed={i.active} className={button(i.active)}>
            {i.label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  if (!current.group) {
    return row(
      product.variantLabel,
      variants.map((v) => ({ id: v.id, label: v.label, active: v.id === current.id, pick: () => onChange(v.id) })),
    );
  }

  const groups = [...new Set(variants.map((v) => v.group!))];
  const inGroup = variants.filter((v) => v.group === current.group);
  return (
    <div className={compact ? "space-y-4" : ""}>
      {row(
        product.variantLabel,
        groups.map((g) => ({
          id: g,
          label: g,
          active: g === current.group,
          // Keep the same option (e.g. pack) when switching group, if it exists there.
          pick: () => {
            const next = variants.filter((v) => v.group === g);
            onChange((next.find((v) => v.option === current.option) ?? next[0]).id);
          },
        })),
      )}
      {inGroup.length > 1 &&
        row(
          product.optionLabel ?? "Option",
          inGroup.map((v) => ({ id: v.id, label: v.option ?? v.label, active: v.id === current.id, pick: () => onChange(v.id) })),
        )}
    </div>
  );
}
