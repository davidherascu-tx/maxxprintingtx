import type { Metadata } from "next";
import Link from "next/link";
import { getDesignConfig } from "@/lib/design-config";
import { requireStaff } from "@/lib/staff-session";
import { getCatalog, getOverrides } from "@/lib/store";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Design studio" };

export default async function AdminDesignAreas() {
  await requireStaff("/admin/design-areas");
  const [catalog, overrides] = await Promise.all([getCatalog(), getOverrides()]);
  const list = catalog.all.filter((p) => getDesignConfig(p.slug)?.kind === "mockup");
  return (
    <>
      <PageHeader title="Design studio print areas" />
      <p className="-mt-3 mb-5 max-w-3xl text-sm text-ink/60">
        Pick a product to move the box where customers can place their artwork on the product photo.
      </p>
      <Card>
        <ul className="-my-2 divide-y divide-line">
          {list.map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/admin/design-areas/${p.slug}`} className="font-medium text-navy hover:underline">{p.name}</Link>
              {overrides[p.slug]?.areas && <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-ink/60">Adjusted</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
