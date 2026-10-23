import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { baseProduct } from "@/lib/catalog";
import { resetDesignAreas, saveDesignAreas } from "@/lib/admin-actions";
import { getDesignConfig } from "@/lib/design-config";
import { requireStaff } from "@/lib/staff-session";
import { getOverrides } from "@/lib/store";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { AreaEditor } from "@/components/admin/area-editor";
import { Card, PageHeader } from "@/components/admin/ui";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Print area: ${baseProduct((await params).slug)?.name ?? "Product"}` };
}

export default async function AdminDesignArea({ params }: Props) {
  const { slug } = await params;
  await requireStaff(`/admin/design-areas/${slug}`);
  const base = baseProduct(slug);
  const areas = (await getOverrides())[slug]?.areas;
  const config = getDesignConfig(slug, areas);
  if (!base || config?.kind !== "mockup") notFound();

  return (
    <>
      <Link href="/admin/design-areas" className="text-sm text-ink/60 hover:text-navy">← Design studio</Link>
      <PageHeader title={base.name}>
        <Link href={`/design/${slug}`} target="_blank" className="btn-outline px-4 py-2">Open in studio ↗</Link>
      </PageHeader>
      <Card>
        <p className="mb-4 text-sm text-ink/60">Drag the dots to reshape the pink area, or drag inside it to move it. Use “Add point” for more corners and “Triangle” for a triangle. This is where customers can add their artwork.</p>
        <AdminForm action={saveDesignAreas} submit="Save print areas" className="space-y-6">
          <input type="hidden" name="slug" value={slug} />
          {config.sides.map((s) => (
            <div key={s.id}>
              <h2 className="mb-2 font-semibold text-navy">{s.label}</h2>
              <AreaEditor side={s.id} mockup={s.mockup} initial={s.area} />
            </div>
          ))}
        </AdminForm>
      </Card>
      {areas && (
        <Card title="Back to default" className="mt-6">
          <p className="mb-3 text-sm text-ink/60">Use the print areas defined in code again.</p>
          <form action={resetDesignAreas}>
            <input type="hidden" name="slug" value={slug} />
            <SubmitButton confirm="Reset the print areas to the defaults?">Reset print areas</SubmitButton>
          </form>
        </Card>
      )}
    </>
  );
}
