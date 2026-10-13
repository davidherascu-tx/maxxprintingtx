-- Run once in Neon: SQL Editor > paste > Run.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  phone text,
  company text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  slug text NOT NULL,
  variant text NOT NULL,
  sides text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Set when a user deletes a design that an order still uses; such designs are hidden, not removed.
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS designs_user_idx ON designs (user_id);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  tax numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  stripe_session_id text,
  paid_at timestamptz,
  notes text NOT NULL DEFAULT '',
  fulfillment text NOT NULL,
  address text,
  status text NOT NULL DEFAULT 'Received',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);

-- Admin backend. Safe to run again on an existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

-- Admin edits to products defined in lib/catalog.ts (price, name, hidden...), keyed by slug.
CREATE TABLE IF NOT EXISTS product_overrides (
  slug text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Store settings edited in Admin → Settings (business info, tax rate, fulfillment).
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Staff logins for /admin, separate from customer accounts. Create the first one with
-- `npm run admin:create`; add more in Admin → Staff.
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_changed_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Artwork approval: staff review, proof to the customer, customer approves or asks for changes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval text NOT NULL DEFAULT 'review';
CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  actor_name text NOT NULL,
  kind text NOT NULL,
  note text NOT NULL DEFAULT '',
  image text
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, at);
