// Create a staff login for /admin, or set a new password for an existing one
// (e.g. if every admin is locked out). Run from the project folder:
//
//   npm run admin:create
//
// Uses DATABASE_URL from .env.local. The password is typed here and never shown or stored
// in plain text: only its scrypt hash (same format as lib/session.ts) is saved.

import { neon } from "@neondatabase/serverless";
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this with: npm run admin:create");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// One readline for every question. Answers are queued line by line, so nothing typed (or
// left over from the Enter key) is lost or spills into the wrong question.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
let muted = false;
// While muted, typed characters are not echoed.
rl._writeToOutput = (s) => {
  if (!muted) rl.output.write(s);
};
const queued = [];
const waiting = [];
let closed = false;
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : queued.push(line)));
rl.on("close", () => {
  closed = true;
  for (const w of waiting.splice(0)) w(null);
});
rl.on("SIGINT", () => {
  rl.output.write("\n");
  process.exit(130);
});

function done(code = 0) {
  rl.close();
  process.exit(code);
}

function fail(message) {
  console.error(message);
  done(1);
}

function nextLine() {
  if (queued.length) return Promise.resolve(queued.shift());
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => waiting.push(resolve));
}

async function ask(question) {
  rl.output.write(question);
  const line = await nextLine();
  if (line === null) fail("\nCancelled.");
  return line.trim();
}

/** Ask without showing what is typed. */
async function askHidden(question) {
  rl.output.write(question);
  muted = true;
  const line = await nextLine();
  muted = false;
  if (process.stdin.isTTY) rl.output.write("\n");
  if (line === null) fail("Cancelled.");
  return line;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

const email = (await ask("Staff email: ")).toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("That doesn't look like an email address.");

let existing;
try {
  [existing] = await sql`SELECT id, name FROM staff WHERE email = ${email}`;
} catch (e) {
  if (e?.code === "42P01") fail('The "staff" table doesn\'t exist yet. Run the end of db/schema.sql in the Neon SQL editor first.');
  throw e;
}

const name = existing ? existing.name : await ask("Name: ");
if (!existing && name.length < 2) fail("Please enter a name.");
if (existing) console.log(`${existing.name} already has a staff login. Enter a new password to replace theirs.`);

const password = await askHidden("Password (at least 8 characters, hidden): ");
if (password.length < 8) fail(`The password must be at least 8 characters (you typed ${password.length}).`);
if ((await askHidden("Repeat password: ")) !== password) fail("The passwords don't match.");

const hash = await hashPassword(password);
if (existing) {
  await sql`UPDATE staff SET password_hash = ${hash}, password_changed_at = now() WHERE id = ${existing.id}`;
  console.log(`Password updated for ${existing.name}. Sign in at /admin/login.`);
} else {
  await sql`INSERT INTO staff (id, name, email, password_hash) VALUES (${randomUUID()}, ${name}, ${email}, ${hash})`;
  console.log(`Staff login created for ${name}. Sign in at /admin/login.`);
}
done();
