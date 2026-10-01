import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Simple JSON file store for local development / single-server hosting.
// Swap these functions for a real database (Postgres, etc.) before deploying
// to a serverless host, where the filesystem is read-only.

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

type Data = { users: User[]; orders: Order[]; designs: Design[] };

const file = path.join(process.cwd(), "data", "db.json");

async function load(): Promise<Data> {
  try {
    return { users: [], orders: [], designs: [], ...JSON.parse(await fs.readFile(file, "utf8")) } as Data;
  } catch {
    return { users: [], orders: [], designs: [] };
  }
}

// Serialize writes so concurrent requests don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (data: Data) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = await load();
    const result = fn(data);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export async function findUserByEmail(email: string) {
  const { users } = await load();
  return users.find((u) => u.email === email.toLowerCase());
}

export async function findUserById(id: string) {
  const { users } = await load();
  return users.find((u) => u.id === id);
}

export function createUser(input: Omit<User, "id" | "createdAt">) {
  return mutate((data) => {
    if (data.users.some((u) => u.email === input.email)) return null;
    const user: User = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    data.users.push(user);
    return user;
  });
}

export function updateUser(id: string, patch: Partial<Pick<User, "name" | "phone" | "company">>) {
  return mutate((data) => {
    const user = data.users.find((u) => u.id === id);
    if (user) Object.assign(user, patch);
    return user;
  });
}

export async function ordersForUser(userId: string) {
  const { orders } = await load();
  return orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createOrder(input: Omit<Order, "id" | "number" | "status" | "createdAt">) {
  return mutate((data) => {
    const order: Order = {
      ...input,
      id: randomUUID(),
      number: `MX-${String(1001 + data.orders.length)}`,
      status: "Received",
      createdAt: new Date().toISOString(),
    };
    data.orders.push(order);
    return order;
  });
}

export async function findDesign(id: string) {
  const { designs } = await load();
  return designs.find((d) => d.id === id);
}

export async function designsForUser(userId: string) {
  const { designs } = await load();
  return designs
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createDesign(input: Omit<Design, "createdAt">) {
  return mutate((data) => {
    const design: Design = { ...input, createdAt: new Date().toISOString() };
    data.designs.push(design);
    return design;
  });
}

/** Attach anonymous designs to a user (e.g. when they sign in to check out). */
export function claimDesigns(ids: string[], userId: string) {
  return mutate((data) => {
    for (const d of data.designs) if (ids.includes(d.id) && d.userId === null) d.userId = userId;
  });
}
