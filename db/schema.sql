-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- The app reaches these tables only from the server (direct Postgres connection), so
-- row level security is on with no public policies: the public anon key can't read them.

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

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
