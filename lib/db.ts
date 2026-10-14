import "server-only";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { gangSlugs, needsDesignCheck, type DesignSource } from "./design-config";
import { asAddress, type Address } from "./address";

// Postgres store (Neon). Needs DATABASE_URL (the Neon pooled connection string).

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  company?: string;
  /** When the password was last set by staff; older sessions are signed out. */
  passwordChangedAt?: string;
  /** Set when the customer clicks the link in the activation email. Unconfirmed accounts can't sign in. */
  emailVerifiedAt?: string;
  billingAddress?: Address;
  /** Undefined = same as the billing address. */
  shippingAddress?: Address;
  createdAt: string;
};

export type Design = {
  id: string;
  userId: string | null;
  slug: string;
  variant: string;
  sides: string[];
  createdAt: string;
};

export type OrderItem = {
  slug: string;
  designId?: string;
  preview?: string;
  name: string;
  variant: string;
  color?: string;
  price: number;
  qty: number;
};

/**
 * Design approval, done by the shop, only for orders with a Design Studio / DTF design:
 * review (staff check the design) → approved, or artwork_issue (staff asked the customer to
 * change something; back to review when it's fixed). Orders without a design start approved.
 * proof_sent and changes_requested are from the earlier customer-proof flow; old orders in
 * those steps are treated like review.
 */
export type Approval = "review" | "artwork_issue" | "proof_sent" | "changes_requested" | "approved";
export const APPROVALS: Approval[] = ["review", "artwork_issue", "proof_sent", "changes_requested", "approved"];

export type Order = {
  id: string;
  number: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  /** Sales tax on the subtotal. */
  tax: number;
  paymentStatus: "unpaid" | "paid" | "invoice";
  stripeSessionId?: string;
  notes: string;
  fulfillment: "pickup" | "delivery";
  address?: string;
  status: "Received" | "In production" | "Ready" | "Completed";
  /** Internal notes, only shown to staff. */
  adminNotes: string;
  approval: Approval;
  paidAt?: string;
  /** Copies of the addresses at the time of the order (older orders may not have them). */
  billingAddress?: Address;
  shippingAddress?: Address;
  /** requested (customer asked) → refunded / partial, or declined. Undefined = never asked or refunded. */
  refundStatus?: "requested" | "declined" | "refunded" | "partial";
  refundReason?: string;
  refundRequestedAt?: string;
  /** Total refunded so far (dollars). */
  refundAmount: number;
  refundedAt?: string;
  createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * Run a query. Connects lazily so builds don't need DATABASE_URL. Uses Neon's serverless driver,
 * which sends each query over HTTPS: Cloudflare Workers can't open a direct Postgres connection
 * to Neon, and can't reuse sockets across requests anyway. Use the pooled connection string.
 * The schema lives in db/schema.sql and is applied once in the Neon SQL editor.
 */
async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DB: DATABASE_URL is not set in this environment");
    throw new Error("DATABASE_URL must be set");
  }
  try {
    return (await neon(url)(strings, ...values)) as Row[];
  } catch (e) {
    // Cloudflare logs only show a stack trace, so print the message too.
    console.error("DB query failed:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    throw e;
  }
}

const iso = (d: Date | string) => new Date(d).toISOString();

const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  phone: r.phone ?? undefined,
  company: r.company ?? undefined,
  passwordChangedAt: r.password_changed_at ? iso(r.password_changed_at) : undefined,
  emailVerifiedAt: r.email_verified_at ? iso(r.email_verified_at) : undefined,
  billingAddress: asAddress(r.billing_address),
  shippingAddress: asAddress(r.shipping_address),
  createdAt: iso(r.created_at),
});

const toDesign = (r: Row): Design => ({
  id: r.id,
  userId: r.user_id,
  slug: r.slug,
  variant: r.variant,
  sides: r.sides,
  createdAt: iso(r.created_at),
});

const toOrder = (r: Row): Order => ({
  id: r.id,
  number: r.number,
  userId: r.user_id,
  items: r.items,
  subtotal: Number(r.subtotal),
  tax: Number(r.tax),
  paymentStatus: r.payment_status,
  stripeSessionId: r.stripe_session_id ?? undefined,
  notes: r.notes,
  fulfillment: r.fulfillment,
  address: r.address ?? undefined,
  status: r.status,
  adminNotes: r.admin_notes ?? "",
  approval: APPROVALS.includes(r.approval) ? r.approval : "review",
  billingAddress: asAddress(r.billing_address),
  shippingAddress: asAddress(r.shipping_address),
  paidAt: r.paid_at ? iso(r.paid_at) : undefined,
  refundStatus: r.refund_status ?? undefined,
  refundReason: r.refund_reason ?? undefined,
  refundRequestedAt: r.refund_requested_at ? iso(r.refund_requested_at) : undefined,
  refundAmount: Number(r.refund_amount ?? 0),
  refundedAt: r.refunded_at ? iso(r.refunded_at) : undefined,
  createdAt: iso(r.created_at),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findUserByEmail(email: string) {
  const [row] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return row ? toUser(row) : undefined;
}

export async function findUserById(id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return row ? toUser(row) : undefined;
}

/** Returns null if the email is already registered. */
export async function createUser(input: Omit<User, "id" | "createdAt" | "passwordChangedAt" | "emailVerifiedAt" | "billingAddress" | "shippingAddress"> & { verified: boolean }) {
  const [row] = await sql`
    INSERT INTO users (id, name, email, password_hash, phone, company, email_verified_at)
    VALUES (${randomUUID()}, ${input.name}, ${input.email}, ${input.passwordHash}, ${input.phone ?? null}, ${input.company ?? null},
      ${input.verified ? new Date().toISOString() : null})
    ON CONFLICT (email) DO NOTHING
    RETURNING *`;
  return row ? toUser(row) : null;
}

export async function updateUser(id: string, patch: Partial<Pick<User, "name" | "phone" | "company">>) {
  const [row] = await sql`
    UPDATE users SET
      name = COALESCE(${patch.name ?? null}, name),
      phone = ${patch.phone ?? null},
      company = ${patch.company ?? null}
    WHERE id = ${id}
    RETURNING *`;
  return row ? toUser(row) : undefined;
}

export async function ordersForUser(userId: string) {
  const rows = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map(toOrder);
}

export const ORDER_STATUSES: Order["status"][] = ["Received", "In production", "Ready", "Completed"];

export type AdminOrder = Order & { customer: { name: string; email: string; phone?: string; company?: string } };

/** Every order with its customer, newest first. For staff only. */
export async function allOrders(limit = 200): Promise<AdminOrder[]> {
  const rows = await sql`
    SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone, u.company AS customer_company
    FROM orders o JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    ...toOrder(r),
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone ?? undefined, company: r.customer_company ?? undefined },
  }));
}

export async function setOrderStatus(id: string, status: Order["status"]) {
  if (!UUID.test(id) || !ORDER_STATUSES.includes(status)) return;
  await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
}

/** Creates an order awaiting payment. */
export async function createOrder(
  input: Omit<Order, "id" | "number" | "status" | "createdAt" | "paymentStatus" | "stripeSessionId" | "adminNotes" | "paidAt" | "approval" | "refundStatus" | "refundReason" | "refundRequestedAt" | "refundAmount" | "refundedAt">,
) {
  const [row] = await sql`
    INSERT INTO orders (id, number, user_id, items, subtotal, tax, notes, fulfillment, address, payment_status, approval, billing_address, shipping_address)
    VALUES (
      ${randomUUID()}, 'MX-' || nextval('order_number_seq'), ${input.userId}, ${JSON.stringify(input.items)}::text::jsonb,
      ${input.subtotal}, ${input.tax}, ${input.notes}, ${input.fulfillment}, ${input.address ?? null}, 'unpaid',
      ${needsDesignCheck(input.items) ? "review" : "approved"},
      ${input.billingAddress ? JSON.stringify(input.billingAddress) : null}::text::jsonb,
      ${input.shippingAddress ? JSON.stringify(input.shippingAddress) : null}::text::jsonb
    )
    RETURNING *`;
  return toOrder(row);
}

export async function findOrder(id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`SELECT * FROM orders WHERE id = ${id}`;
  return row ? toOrder(row) : undefined;
}

export async function setOrderSession(id: string, sessionId: string) {
  await sql`UPDATE orders SET stripe_session_id = ${sessionId} WHERE id = ${id}`;
}

export async function unpaidOrdersForUser(userId: string) {
  const rows = await sql`SELECT * FROM orders WHERE user_id = ${userId} AND payment_status = 'unpaid'`;
  return rows.map(toOrder);
}

export async function deleteUnpaidOrder(id: string) {
  await sql`DELETE FROM orders WHERE id = ${id} AND payment_status = 'unpaid'`;
}

/**
 * Mark an order paid once Stripe confirms the charge. The amount must match what we asked
 * for. Safe to call twice (the webhook and the return page both do). Returns whether it is paid.
 */
export async function markOrderPaid(id: string, sessionId: string, amountCents: number) {
  if (!UUID.test(id)) return { paid: false, justPaid: false };
  const updated = await sql`
    UPDATE orders SET payment_status = 'paid', paid_at = now(), stripe_session_id = ${sessionId}
    WHERE id = ${id} AND payment_status = 'unpaid' AND round((subtotal + tax) * 100) = ${amountCents}
    RETURNING id`;
  const [row] = await sql`SELECT payment_status FROM orders WHERE id = ${id}`;
  /** justPaid: this call is the one that marked it paid (so confirmation emails go out once). */
  return { paid: row?.payment_status === "paid", justPaid: updated.length > 0 };
}

export async function findDesign(id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`SELECT * FROM designs WHERE id = ${id}`;
  return row ? toDesign(row) : undefined;
}

export async function designsForUser(userId: string) {
  const rows = await sql`SELECT * FROM designs WHERE user_id = ${userId} AND deleted_at IS NULL ORDER BY created_at DESC`;
  return rows.map(toDesign);
}

export async function createDesign(input: Omit<Design, "createdAt">) {
  const [row] = await sql`
    INSERT INTO designs (id, user_id, slug, variant, sides)
    VALUES (${input.id}, ${input.userId}, ${input.slug}, ${input.variant}, ${input.sides})
    RETURNING *`;
  return toDesign(row);
}

/** Attach anonymous designs to a user (e.g. when they sign in to check out). */
export async function claimDesigns(ids: string[], userId: string) {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length) await sql`UPDATE designs SET user_id = ${userId} WHERE id = ANY(${valid}::uuid[]) AND user_id IS NULL`;
}

/**
 * Delete one of a user's designs. A design an order still uses is only hidden, so the
 * order keeps its preview and print files. Returns null if the user doesn't own it;
 * `removed` says whether the row is gone (and its files can be deleted too).
 */
export async function deleteDesign(id: string, userId: string) {
  if (!UUID.test(id)) return null;
  const used = JSON.stringify([{ designId: id }]);
  const [removed] = await sql`
    DELETE FROM designs WHERE id = ${id} AND user_id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM orders WHERE items @> ${used}::text::jsonb)
    RETURNING id`;
  if (removed) return { removed: true };
  const [hidden] = await sql`UPDATE designs SET deleted_at = now() WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return hidden ? { removed: false } : null;
}

// ---------------------------------------------------------------------------
// Staff (admin) queries. Callers must check requireStaff first.
// ---------------------------------------------------------------------------

/** Postgres "undefined table": the admin migration (db/schema.sql) hasn't been run yet. */
const missingTable = (e: unknown) => (e as { code?: string })?.code === "42P01";

/** Product edits made in Admin → Products, keyed by product slug. */
export async function loadOverrides(): Promise<Record<string, unknown>> {
  try {
    const rows = await sql`SELECT slug, data FROM product_overrides`;
    return Object.fromEntries(rows.map((r) => [r.slug, r.data]));
  } catch (e) {
    if (missingTable(e)) return {};
    throw e;
  }
}

export async function saveOverride(slug: string, data: unknown) {
  await sql`
    INSERT INTO product_overrides (slug, data, updated_at) VALUES (${slug}, ${JSON.stringify(data)}::text::jsonb, now())
    ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}

export async function deleteOverride(slug: string) {
  await sql`DELETE FROM product_overrides WHERE slug = ${slug}`;
}

/** Store settings saved in Admin → Settings, or null if never saved. */
export async function loadSettings(): Promise<unknown> {
  try {
    const [row] = await sql`SELECT value FROM settings WHERE key = 'store'`;
    return row?.value ?? null;
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

export async function saveSettings(value: unknown) {
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('store', ${JSON.stringify(value)}::text::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

/**
 * Numbers for the admin dashboard. Revenue counts paid orders by when they were paid (days are
 * Houston time); "open" orders are paid or invoiced but not completed.
 */
export async function dashboardStats() {
  const [totals] = await sql`
    SELECT
      COALESCE(sum(subtotal + tax - refund_amount) FILTER (WHERE payment_status = 'paid'
        AND COALESCE(paid_at, created_at) >= (date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')), 0) AS today,
      COALESCE(sum(subtotal + tax - refund_amount) FILTER (WHERE payment_status = 'paid' AND COALESCE(paid_at, created_at) >= now() - interval '7 days'), 0) AS week,
      COALESCE(sum(subtotal + tax - refund_amount) FILTER (WHERE payment_status = 'paid' AND COALESCE(paid_at, created_at) >= now() - interval '30 days'), 0) AS month,
      count(*) FILTER (WHERE payment_status = 'paid' AND COALESCE(paid_at, created_at) >= now() - interval '30 days') AS month_orders,
      count(*) FILTER (WHERE payment_status <> 'unpaid' AND status <> 'Completed') AS open_orders,
      count(*) FILTER (WHERE payment_status = 'unpaid') AS awaiting_payment,
      count(*) FILTER (WHERE payment_status = 'invoice') AS invoiced
    FROM orders`;
  const byApproval = await sql`
    SELECT approval, count(*) AS n FROM orders
    WHERE payment_status <> 'unpaid' AND status <> 'Completed' GROUP BY approval`;
  /** The admin home page's to-do list: placed, open orders per next step. */
  const [todo] = await sql`
    SELECT
      count(*) FILTER (WHERE approval IN ('review', 'proof_sent', 'changes_requested')) AS to_check,
      0 AS to_fix,
      count(*) FILTER (WHERE approval = 'artwork_issue') AS waiting,
      count(*) FILTER (WHERE approval = 'approved' AND status = 'Received') AS to_print,
      count(*) FILTER (WHERE approval = 'approved' AND status = 'In production') AS printing,
      count(*) FILTER (WHERE status = 'Ready') AS ready
    FROM orders WHERE payment_status <> 'unpaid' AND status <> 'Completed' AND COALESCE(refund_status, '') <> 'refunded'`;
  const [refunds] = await sql`SELECT count(*) AS n FROM orders WHERE refund_status = 'requested'`;
  const byStatus = await sql`
    SELECT status, count(*) AS n FROM orders WHERE payment_status <> 'unpaid' GROUP BY status`;
  const [customers] = await sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_30 FROM users`;
  const daily = await sql`
    SELECT to_char(date_trunc('day', COALESCE(paid_at, created_at) AT TIME ZONE 'America/Chicago'), 'YYYY-MM-DD') AS day,
           sum(subtotal + tax - refund_amount) AS revenue, count(*) AS orders
    FROM orders
    WHERE payment_status = 'paid' AND COALESCE(paid_at, created_at) >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`;
  const top = await sql`
    SELECT i->>'slug' AS slug, max(i->>'name') AS name, sum((i->>'qty')::int) AS qty,
           sum((i->>'price')::numeric * (i->>'qty')::int) AS revenue
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) AS i
    WHERE o.payment_status = 'paid' AND COALESCE(o.paid_at, o.created_at) >= now() - interval '30 days'
    GROUP BY 1 ORDER BY revenue DESC LIMIT 5`;
  return {
    revenue: { today: Number(totals.today), week: Number(totals.week), month: Number(totals.month) },
    monthOrders: Number(totals.month_orders),
    openOrders: Number(totals.open_orders),
    awaitingPayment: Number(totals.awaiting_payment),
    invoiced: Number(totals.invoiced),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    todo: {
      toCheck: Number(todo.to_check),
      toFix: Number(todo.to_fix),
      waiting: Number(todo.waiting),
      toPrint: Number(todo.to_print),
      printing: Number(todo.printing),
      ready: Number(todo.ready),
      refunds: Number(refunds.n),
    },
    /** Open (placed, not completed) orders per approval step. */
    byApproval: Object.fromEntries(byApproval.map((r) => [r.approval, Number(r.n)])) as Partial<Record<Approval, number>>,
    customers: { total: Number(customers.total), new30: Number(customers.new_30) },
    daily: daily.map((r) => ({ day: r.day as string, revenue: Number(r.revenue), orders: Number(r.orders) })),
    topProducts: top.map((r) => ({ slug: r.slug as string, name: r.name as string, qty: Number(r.qty), revenue: Number(r.revenue) })),
  };
}

const PAGE_SIZE = 25;
/** `%term%` for ILIKE, with the user's own % and _ taken literally. */
const likeTerm = (q: string) => "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";

const toAdminOrder = (r: Row): AdminOrder => ({
  ...toOrder(r),
  customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone ?? undefined, company: r.customer_company ?? undefined },
});

/** Which orders a list shows: "placed" (paid or invoiced, the default), one payment status, or everything. */
export type PaymentFilter = "placed" | "paid" | "invoice" | "unpaid" | "all";

export async function searchOrders(opts: {
  q?: string;
  status?: string;
  payment?: PaymentFilter;
  /** One approval step, or several (any of them). */
  approval?: string | string[];
  /** Leave out completed orders. */
  open?: boolean;
  /** Orders with at least one item of this kind. */
  source?: DesignSource;
  refund?: "requested";
  page?: number;
}) {
  const q = opts.q?.trim() ? likeTerm(opts.q.trim()) : null;
  const status = ORDER_STATUSES.find((s) => s === opts.status) ?? null;
  const wanted = ([] as string[]).concat(opts.approval ?? []).filter((a): a is Approval => APPROVALS.includes(a as Approval));
  const approvals = wanted.length ? wanted : null;
  const open = !!opts.open;
  const refund = opts.refund ?? null;
  const source = opts.source ?? null;
  const payment = opts.payment ?? "placed";
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const rows = await sql`
    SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone, u.company AS customer_company,
           count(*) OVER () AS total_count
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE (${q}::text IS NULL OR o.number ILIKE ${q} OR u.name ILIKE ${q} OR u.email ILIKE ${q} OR COALESCE(u.company, '') ILIKE ${q})
      AND (${status}::text IS NULL OR o.status = ${status})
      AND (${payment}::text = 'all' OR (${payment}::text = 'placed' AND o.payment_status <> 'unpaid') OR o.payment_status = ${payment})
      AND (${approvals}::text[] IS NULL OR o.approval = ANY(${approvals}::text[]))
      AND (NOT ${open}::boolean OR (o.status <> 'Completed' AND COALESCE(o.refund_status, '') <> 'refunded'))
      AND (${refund}::text IS NULL OR o.refund_status = ${refund})
      AND (${source}::text IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) AS i
        WHERE CASE ${source}::text
          WHEN 'none' THEN NOT (i ? 'designId')
          WHEN 'dtf' THEN i ? 'designId' AND i->>'slug' = ANY(${gangSlugs}::text[])
          ELSE i ? 'designId' AND NOT (i->>'slug' = ANY(${gangSlugs}::text[]))
        END))
    ORDER BY o.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return { orders: rows.map(toAdminOrder), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function findOrderByNumber(number: string) {
  const [row] = await sql`
    SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone, u.company AS customer_company
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.number = ${number}`;
  return row ? toAdminOrder(row) : undefined;
}

export async function setOrderAdminNotes(id: string, notes: string) {
  if (!UUID.test(id)) return;
  await sql`UPDATE orders SET admin_notes = ${notes} WHERE id = ${id}`;
}

/**
 * Record a payment taken outside Stripe (cash, check, invoice). An order is never moved back to
 * unpaid: unpaid orders are deleted when the customer starts a new checkout.
 */
/** Returns whether the order was unpaid until now (i.e. it has just become a placed order). */
export async function setOrderPayment(id: string, to: "paid" | "invoice") {
  if (!UUID.test(id)) return false;
  const rows =
    to === "paid"
      ? await sql`
          UPDATE orders o SET payment_status = 'paid', paid_at = COALESCE(o.paid_at, now())
          FROM orders before WHERE o.id = ${id} AND before.id = o.id AND o.payment_status IN ('unpaid', 'invoice')
          RETURNING before.payment_status AS was`
      : await sql`UPDATE orders SET payment_status = 'invoice' WHERE id = ${id} AND payment_status = 'unpaid' RETURNING 'unpaid' AS was`;
  return rows[0]?.was === "unpaid";
}

export type CustomerRow = User & { orders: number; spent: number; lastOrder?: string };

export async function searchCustomers(opts: { q?: string; page?: number }) {
  const q = opts.q?.trim() ? likeTerm(opts.q.trim()) : null;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const rows = await sql`
    SELECT u.*,
           count(o.id) FILTER (WHERE o.payment_status <> 'unpaid') AS order_count,
           COALESCE(sum(o.subtotal + o.tax) FILTER (WHERE o.payment_status = 'paid'), 0) AS spent,
           max(o.created_at) FILTER (WHERE o.payment_status <> 'unpaid') AS last_order,
           count(*) OVER () AS total_count
    FROM users u LEFT JOIN orders o ON o.user_id = u.id
    WHERE (${q}::text IS NULL OR u.name ILIKE ${q} OR u.email ILIKE ${q} OR COALESCE(u.company, '') ILIKE ${q} OR COALESCE(u.phone, '') ILIKE ${q})
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const customers: CustomerRow[] = rows.map((r) => ({
    ...toUser(r),
    orders: Number(r.order_count),
    spent: Number(r.spent),
    lastOrder: r.last_order ? iso(r.last_order) : undefined,
  }));
  return { customers, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Staff edit of a customer. Returns "taken" if the new email belongs to someone else. */
export async function adminUpdateUser(id: string, patch: Pick<User, "name" | "email"> & Partial<Pick<User, "phone" | "company">>) {
  if (!UUID.test(id)) return undefined;
  const [clash] = await sql`SELECT id FROM users WHERE email = ${patch.email} AND id <> ${id}`;
  if (clash) return "taken" as const;
  const [row] = await sql`
    UPDATE users SET name = ${patch.name}, email = ${patch.email}, phone = ${patch.phone ?? null}, company = ${patch.company ?? null}
    WHERE id = ${id} RETURNING *`;
  return row ? toUser(row) : undefined;
}

/** Set a new password hash. Sessions created before now stop working. */
export async function setUserPassword(id: string, passwordHash: string) {
  if (!UUID.test(id)) return;
  // The app's clock, not the database's: sessions are compared against it, and a session made right
  // after this (e.g. after a reset) must count as newer even if the clocks differ slightly.
  await sql`UPDATE users SET password_hash = ${passwordHash}, password_changed_at = ${new Date().toISOString()} WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Staff accounts: separate from customers, with their own sign-in at /admin/login.
// ---------------------------------------------------------------------------

export type Staff = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
};

const toStaff = (r: Row): Staff => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  passwordChangedAt: r.password_changed_at ? iso(r.password_changed_at) : undefined,
  lastLoginAt: r.last_login_at ? iso(r.last_login_at) : undefined,
  createdAt: iso(r.created_at),
});

export async function findStaffByEmail(email: string) {
  const [row] = await sql`SELECT * FROM staff WHERE email = ${email.toLowerCase()}`;
  return row ? toStaff(row) : undefined;
}

export async function findStaffById(id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`SELECT * FROM staff WHERE id = ${id}`;
  return row ? toStaff(row) : undefined;
}

export async function listStaffMembers() {
  return (await sql`SELECT * FROM staff ORDER BY name`).map(toStaff);
}

/** Returns null if a staff login with this email exists. */
export async function createStaff(input: { name: string; email: string; passwordHash: string }) {
  const [row] = await sql`
    INSERT INTO staff (id, name, email, password_hash) VALUES (${randomUUID()}, ${input.name}, ${input.email.toLowerCase()}, ${input.passwordHash})
    ON CONFLICT (email) DO NOTHING RETURNING *`;
  return row ? toStaff(row) : null;
}

/** New password; that staff member's existing sessions stop working. */
export async function setStaffPassword(id: string, passwordHash: string) {
  if (!UUID.test(id)) return;
  // App clock, as for customers (see setUserPassword).
  await sql`UPDATE staff SET password_hash = ${passwordHash}, password_changed_at = ${new Date().toISOString()} WHERE id = ${id}`;
}

export async function touchStaffLogin(id: string) {
  await sql`UPDATE staff SET last_login_at = now() WHERE id = ${id}`;
}

/** Removes a staff login unless it's the last one (so the admin can't be locked). */
export async function deleteStaff(id: string) {
  if (!UUID.test(id)) return false;
  const rows = await sql`DELETE FROM staff WHERE id = ${id} AND (SELECT count(*) FROM staff) > 1 RETURNING id`;
  return rows.length === 1;
}

// ---------------------------------------------------------------------------
// Artwork approval: the order's approval step plus a history of what happened.
// ---------------------------------------------------------------------------

export type OrderEventKind =
  | "proof_sent" // staff sent a proof
  | "artwork_issue" // staff need new or better artwork from the customer
  | "artwork_ok" // staff: artwork issue sorted, back to review
  | "approved_by_staff" // staff recorded an approval given another way (phone, email, in store)
  | "approved" // customer approved the proof
  | "changes_requested" // customer asked for changes
  | "refund_requested" // customer asked for a refund
  | "refunded" // staff refunded (some or all of) the order
  | "refund_declined"; // staff declined the refund request

export type OrderEvent = {
  id: string;
  orderId: string;
  at: string;
  actor: "staff" | "customer";
  actorName: string;
  kind: OrderEventKind;
  note: string;
  /** Proof image id, served by /api/orders/<orderId>/proof/<image>. */
  image?: string;
};

const toEvent = (r: Row): OrderEvent => ({
  id: r.id,
  orderId: r.order_id,
  at: iso(r.at),
  actor: r.actor,
  actorName: r.actor_name,
  kind: r.kind,
  note: r.note ?? "",
  image: r.image ?? undefined,
});

/** Oldest first. */
export async function eventsForOrders(orderIds: string[]) {
  const ids = orderIds.filter((id) => UUID.test(id));
  if (!ids.length) return [];
  try {
    return (await sql`SELECT * FROM order_events WHERE order_id = ANY(${ids}::uuid[]) ORDER BY at`).map(toEvent);
  } catch (e) {
    if (missingTable(e)) return [];
    throw e;
  }
}

/**
 * Move an order to a new approval step, but only from one of `from` (so two people clicking at
 * once can't skip a step), and record what happened. Returns whether the order moved.
 */
export async function moveApproval(
  orderId: string,
  from: Approval[],
  to: Approval,
  event: Omit<OrderEvent, "id" | "orderId" | "at">,
) {
  if (!UUID.test(orderId)) return false;
  const moved = await sql`
    UPDATE orders SET approval = ${to}
    WHERE id = ${orderId} AND approval = ANY(${from}::text[]) AND payment_status <> 'unpaid'
    RETURNING id`;
  if (!moved.length) return false;
  await sql`
    INSERT INTO order_events (id, order_id, actor, actor_name, kind, note, image)
    VALUES (${randomUUID()}, ${orderId}, ${event.actor}, ${event.actorName}, ${event.kind}, ${event.note}, ${event.image ?? null})`;
  return true;
}

// ---------------------------------------------------------------------------
// Email confirmation (account activation)
// ---------------------------------------------------------------------------

/** Activate an account. Only works while the email is still the one the link was sent to. */
export async function markEmailVerified(id: string, email: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`
    UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
    WHERE id = ${id} AND email = ${email.toLowerCase()} RETURNING *`;
  return row ? toUser(row) : undefined;
}

/**
 * Note that an activation email is going out. Returns false if one went out in the last
 * two minutes, so the button (or someone else) can't flood an inbox.
 */
export async function claimVerificationEmail(id: string) {
  if (!UUID.test(id)) return false;
  const rows = await sql`
    UPDATE users SET verification_sent_at = now()
    WHERE id = ${id} AND email_verified_at IS NULL
      AND (verification_sent_at IS NULL OR verification_sent_at < now() - interval '2 minutes')
    RETURNING id`;
  return rows.length > 0;
}

/** Note that a password reset email is going out; false if one went out in the last two minutes. */
export async function claimResetEmail(id: string) {
  if (!UUID.test(id)) return false;
  const rows = await sql`
    UPDATE users SET reset_sent_at = now()
    WHERE id = ${id} AND (reset_sent_at IS NULL OR reset_sent_at < now() - interval '2 minutes')
    RETURNING id`;
  return rows.length > 0;
}

/** Orders waiting for staff (to check, to fix, to print, printing), for the badge in the admin menu. */
export async function countStaffTodo() {
  const [r] = await sql`
    SELECT count(*) AS n FROM orders
    WHERE refund_status = 'requested'
      OR (payment_status <> 'unpaid' AND status <> 'Completed' AND COALESCE(refund_status, '') <> 'refunded'
        AND (approval IN ('review', 'proof_sent', 'changes_requested') OR (approval = 'approved' AND status IN ('Received', 'In production'))))`;
  return Number(r.n);
}

/** Save a customer's addresses. `shipping` null = same as billing. */
export async function saveUserAddresses(id: string, billing: Address | null, shipping: Address | null) {
  if (!UUID.test(id)) return;
  await sql`
    UPDATE users SET
      billing_address = ${billing ? JSON.stringify(billing) : null}::text::jsonb,
      shipping_address = ${shipping ? JSON.stringify(shipping) : null}::text::jsonb
    WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export async function addOrderEvent(orderId: string, event: Omit<OrderEvent, "id" | "orderId" | "at">) {
  await sql`
    INSERT INTO order_events (id, order_id, actor, actor_name, kind, note, image)
    VALUES (${randomUUID()}, ${orderId}, ${event.actor}, ${event.actorName}, ${event.kind}, ${event.note}, ${event.image ?? null})`;
}

/** A customer asks for a refund. Only for their own placed order, and only if nothing is pending or fully refunded. */
export async function requestRefund(orderId: string, userId: string, reason: string) {
  if (!UUID.test(orderId)) return false;
  const rows = await sql`
    UPDATE orders SET refund_status = 'requested', refund_reason = ${reason}, refund_requested_at = now()
    WHERE id = ${orderId} AND user_id = ${userId} AND payment_status <> 'unpaid'
      AND (refund_status IS NULL OR refund_status IN ('declined', 'partial'))
      AND refund_amount < subtotal + tax
    RETURNING id`;
  return rows.length > 0;
}

/**
 * Record money given back. Refuses more than is left to refund. Returns the new refund status, or
 * null if nothing changed.
 */
export async function recordRefund(orderId: string, amount: number) {
  if (!UUID.test(orderId) || !(amount > 0)) return null;
  const [row] = await sql`
    UPDATE orders SET
      refund_amount = refund_amount + ${amount},
      refund_status = CASE WHEN refund_amount + ${amount} >= subtotal + tax - 0.005 THEN 'refunded' ELSE 'partial' END,
      refunded_at = now()
    WHERE id = ${orderId} AND payment_status <> 'unpaid' AND refund_amount + ${amount} <= subtotal + tax + 0.005
    RETURNING refund_status`;
  return (row?.refund_status as "refunded" | "partial" | undefined) ?? null;
}

export async function declineRefund(orderId: string) {
  if (!UUID.test(orderId)) return false;
  const rows = await sql`UPDATE orders SET refund_status = 'declined' WHERE id = ${orderId} AND refund_status = 'requested' RETURNING id`;
  return rows.length > 0;
}
