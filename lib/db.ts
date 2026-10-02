import "server-only";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

// Postgres store (Neon). Needs DATABASE_URL, which the Neon integration sets on
// the Vercel project; run `vercel env pull .env.local` for local dev.
// Tables are created on first use, so there's no separate migration step.

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  company?: string;
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

export type Order = {
  id: string;
  number: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  notes: string;
  fulfillment: "pickup" | "delivery";
  address?: string;
  status: "Received" | "In production" | "Ready" | "Completed";
  createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

let client: ReturnType<typeof neon> | undefined;
let ready: Promise<unknown> | undefined;

/** Run a query once the schema exists. Connects lazily so builds don't need DATABASE_URL. */
async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL must be set");
    client = neon(url);
  }
  ready ??= migrate(client).catch((e) => {
    ready = undefined;
    throw e;
  });
  await ready;
  return (await client(strings, ...values)) as Row[];
}

async function migrate(db: ReturnType<typeof neon>) {
  await db`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    phone text,
    company text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS designs (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    slug text NOT NULL,
    variant text NOT NULL,
    sides text[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001`;
  await db`CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY,
    number text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES users(id),
    items jsonb NOT NULL,
    subtotal numeric NOT NULL,
    notes text NOT NULL DEFAULT '',
    fulfillment text NOT NULL,
    address text,
    status text NOT NULL DEFAULT 'Received',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id)`;
  await db`CREATE INDEX IF NOT EXISTS designs_user_idx ON designs (user_id)`;
}

const iso = (d: Date | string) => new Date(d).toISOString();

const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  passwordHash: r.password_hash,
  phone: r.phone ?? undefined,
  company: r.company ?? undefined,
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
  notes: r.notes,
  fulfillment: r.fulfillment,
  address: r.address ?? undefined,
  status: r.status,
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
export async function createUser(input: Omit<User, "id" | "createdAt">) {
  const [row] = await sql`
    INSERT INTO users (id, name, email, password_hash, phone, company)
    VALUES (${randomUUID()}, ${input.name}, ${input.email}, ${input.passwordHash}, ${input.phone ?? null}, ${input.company ?? null})
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

export async function createOrder(input: Omit<Order, "id" | "number" | "status" | "createdAt">) {
  const [row] = await sql`
    INSERT INTO orders (id, number, user_id, items, subtotal, notes, fulfillment, address)
    VALUES (
      ${randomUUID()}, 'MX-' || nextval('order_number_seq'), ${input.userId}, ${JSON.stringify(input.items)}::jsonb,
      ${input.subtotal}, ${input.notes}, ${input.fulfillment}, ${input.address ?? null}
    )
    RETURNING *`;
  return toOrder(row);
}

export async function findDesign(id: string) {
  if (!UUID.test(id)) return undefined;
  const [row] = await sql`SELECT * FROM designs WHERE id = ${id}`;
  return row ? toDesign(row) : undefined;
}

export async function designsForUser(userId: string) {
  const rows = await sql`SELECT * FROM designs WHERE user_id = ${userId} ORDER BY created_at DESC`;
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
