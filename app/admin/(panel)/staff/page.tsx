import type { Metadata } from "next";
import { listStaffMembers } from "@/lib/db";
import { addStaff, changeMyPassword, removeStaff, setStaffMemberPassword } from "@/lib/admin-actions";
import { requireStaff } from "@/lib/staff-session";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { Card, dateTime, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Staff" };

function PasswordFields({ prefix = "" }: { prefix?: string }) {
  return (
    <>
      <div>
        <label htmlFor={`${prefix}password`} className="label">New password</label>
        <input id={`${prefix}password`} name="password" type="password" minLength={8} autoComplete="new-password" required className="field" />
      </div>
      <div>
        <label htmlFor={`${prefix}confirm`} className="label">Repeat password</label>
        <input id={`${prefix}confirm`} name="confirm" type="password" minLength={8} autoComplete="new-password" required className="field" />
      </div>
    </>
  );
}

export default async function AdminStaff() {
  const me = await requireStaff("/admin/staff");
  const staff = await listStaffMembers();

  return (
    <>
      <PageHeader title="Staff" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-ink/60">
        Staff logins are separate from customer accounts: they sign in at <b>/admin/login</b>, don&apos;t appear under Customers, and can&apos;t
        be used to shop. Staff can see every order and customer, download print files, and change prices and settings, so only add people you trust.
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Staff logins">
            <ul className="-my-2 divide-y divide-line">
              {staff.map((s) => (
                <li key={s.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-navy">{s.name}</span>
                      {s.id === me.id && <span className="ml-2 text-xs text-ink/50">(you)</span>}
                      <span className="block text-xs text-ink/50">
                        {s.email} · {s.lastLoginAt ? `last signed in ${dateTime(s.lastLoginAt)}` : "never signed in"}
                      </span>
                    </div>
                    {s.id !== me.id && (
                      <div className="flex flex-wrap gap-2">
                        <details className="group">
                          <summary className="btn-outline cursor-pointer list-none px-3 py-1.5 text-sm">Set password</summary>
                          <div className="mt-3 w-72">
                            <AdminForm action={setStaffMemberPassword} submit="Set password" confirm={`Set a new password for ${s.name}? They're signed out everywhere.`}>
                              <input type="hidden" name="id" value={s.id} />
                              <PasswordFields prefix={`${s.id}-`} />
                            </AdminForm>
                          </div>
                        </details>
                        {staff.length > 1 && (
                          <form action={removeStaff}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton confirm={`Remove ${s.name}'s staff login? They lose access to the admin right away.`}>Remove</SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Change my password">
            <AdminForm action={changeMyPassword} submit="Change password" className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <div>
                <label htmlFor="current" className="label">Current password</label>
                <input id="current" name="current" type="password" autoComplete="current-password" required className="field" />
              </div>
              <PasswordFields prefix="me-" />
            </AdminForm>
          </Card>
        </div>

        <Card title="Add a staff login">
          <p className="mb-3 text-sm text-ink/60">Choose a temporary password and give it to them privately. At least 8 characters.</p>
          <AdminForm action={addStaff} submit="Create staff login">
            <div>
              <label htmlFor="name" className="label">Name</label>
              <input id="name" name="name" required className="field" />
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" autoComplete="off" required className="field" />
            </div>
            <PasswordFields prefix="new-" />
          </AdminForm>
        </Card>
      </div>
    </>
  );
}
