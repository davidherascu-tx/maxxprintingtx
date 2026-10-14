import type { Metadata } from "next";
import { saveStoreSettings, sendTestEmailAction } from "@/lib/admin-actions";
import { emailConfigured } from "@/lib/email";
import { requireStaff } from "@/lib/staff-session";
import { getSettings } from "@/lib/store";
import { AdminForm } from "@/components/admin/admin-form";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Settings" };

function Field({ name, label, value, type = "text", required, hint }: { name: string; label: string; value?: string | number; type?: string; required?: boolean; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} required={required} step={type === "number" ? "0.001" : undefined} className="field" />
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

export default async function AdminSettings() {
  await requireStaff("/admin/settings");
  const { site, taxRate, pickup, delivery, notifyEmail, returnPolicy } = await getSettings();

  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        <AdminForm action={saveStoreSettings} submit="Save settings" className="space-y-8">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 font-semibold text-navy">Business</legend>
            <Field name="name" label="Business name" value={site.name} required />
            <Field name="legalName" label="Legal name (footer)" value={site.legalName} />
            <div className="sm:col-span-2"><Field name="tagline" label="Tagline (top bar)" value={site.tagline} /></div>
            <Field name="phoneDisplay" label="Phone" value={site.phoneDisplay} hint="Shown as typed; the call link uses its digits." />
            <Field name="email" label="Email" type="email" value={site.email} required />
            <div className="sm:col-span-2"><Field name="url" label="Website address" type="url" value={site.url} /></div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 font-semibold text-navy">Address</legend>
            <Field name="line1" label="Street" value={site.address.line1} />
            <Field name="line2" label="Suite / unit" value={site.address.line2} />
            <Field name="city" label="City" value={site.address.city} />
            <div className="grid grid-cols-2 gap-4">
              <Field name="state" label="State" value={site.address.state} />
              <Field name="zip" label="ZIP" value={site.address.zip} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 font-semibold text-navy">Order notifications</legend>
            <Field
              name="notifyEmail"
              label="Email new orders to"
              type="email"
              value={notifyEmail}
              required
              hint="Not shown on the website. Customer replies to shop emails also go here."
            />
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-semibold text-navy">Return & refund policy</legend>
            <textarea name="returnPolicy" rows={4} defaultValue={returnPolicy} aria-label="Return and refund policy" className="field" />
            <p className="mt-1 text-xs text-ink/50">Shown on the Ordering page, at checkout and when a customer asks for a refund. Leave empty to use the standard text.</p>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 font-semibold text-navy">Sales tax</legend>
            <Field
              name="taxPercent"
              label="Tax rate (%)"
              type="number"
              value={+(taxRate * 100).toFixed(3)}
              required
              hint="Added to every new order at checkout. Orders already placed keep their tax."
            />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 font-semibold text-navy">Checkout options</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="pickupEnabled" defaultChecked={pickup.enabled} className="h-4 w-4 accent-navy" />
                  Offer store pickup
                </label>
                <div className="mt-3"><Field name="pickupNote" label="Text under the option" value={pickup.note} /></div>
              </div>
              <div className="rounded-xl border border-line p-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="deliveryEnabled" defaultChecked={delivery.enabled} className="h-4 w-4 accent-navy" />
                  Offer local delivery
                </label>
                <div className="mt-3"><Field name="deliveryNote" label="Text under the option" value={delivery.note} /></div>
              </div>
            </div>
          </fieldset>
        </AdminForm>
      </Card>

      <Card title="Email" className="mt-6">
        <p className="mb-4 text-sm text-ink/60">
          {emailConfigured()
            ? `Emails are sent through your mail server (${process.env.SMTP_HOST}). Send a test to check it works, for example to a Gmail address.`
            : "Email isn't set up yet: add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM to the server settings."}
        </p>
        <AdminForm action={sendTestEmailAction} submit="Send test email" className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="test-to" className="label">Send to</label>
            <input id="test-to" name="to" type="email" placeholder={notifyEmail} className="field" />
          </div>
        </AdminForm>
      </Card>
    </>
  );
}
