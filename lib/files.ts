import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

// Uploaded artwork and rendered design files, stored on local disk next to db.json.
// Swap for object storage (S3, Vercel Blob, etc.) on serverless hosts.

const root = path.join(process.cwd(), "data");
const uploadsDir = path.join(root, "uploads");
const designsDir = path.join(root, "designs");

export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ID = /^[0-9a-f-]{36}$/;
export const isId = (id: string) => ID.test(id);

const typeFor = (ext: string) =>
  Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";

export async function saveUpload(id: string, type: string, bytes: Buffer) {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, `${id}.${UPLOAD_TYPES[type]}`), bytes);
}

export async function readUpload(id: string) {
  if (!isId(id)) return null;
  for (const ext of Object.values(UPLOAD_TYPES)) {
    try {
      return { bytes: await fs.readFile(path.join(uploadsDir, `${id}.${ext}`)), type: typeFor(ext) };
    } catch {}
  }
  return null;
}

/** Design files: `design.json`, `<side>-preview.png`, `<side>-print.png`. */
const DESIGN_FILE = /^(design\.json|[a-z]+-(preview|print)\.png)$/;
export const isDesignFile = (name: string) => DESIGN_FILE.test(name);

export async function saveDesignFile(id: string, name: string, bytes: Buffer | string) {
  if (!isId(id) || !isDesignFile(name)) throw new Error("Invalid design file");
  const dir = path.join(designsDir, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
}

export async function readDesignFile(id: string, name: string) {
  if (!isId(id) || !isDesignFile(name)) return null;
  try {
    return await fs.readFile(path.join(designsDir, id, name));
  } catch {
    return null;
  }
}
