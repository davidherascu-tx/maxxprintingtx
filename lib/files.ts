import "server-only";
import { get, put } from "@vercel/blob";

// Uploaded artwork and rendered design files, stored in a private Vercel Blob store.
// Needs BLOB_READ_WRITE_TOKEN (set automatically when a Blob store is connected
// to the Vercel project; run `vercel env pull .env.local` for local dev).
// Files are served through our own /api routes, never by direct Blob URL.

export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ID = /^[0-9a-f-]{36}$/;
export const isId = (id: string) => ID.test(id);

async function write(pathname: string, body: Buffer | string, contentType: string) {
  await put(pathname, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
}

async function read(pathname: string) {
  const result = await get(pathname, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return null;
  return {
    bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
    type: result.blob.contentType,
  };
}

export async function saveUpload(id: string, type: string, bytes: Buffer) {
  await write(`uploads/${id}`, bytes, type);
}

export async function readUpload(id: string) {
  if (!isId(id)) return null;
  return read(`uploads/${id}`);
}

/** Design files: `design.json`, `<side>-preview.png`, `<side>-print.png`. */
const DESIGN_FILE = /^(design\.json|[a-z]+-(preview|print)\.png)$/;
export const isDesignFile = (name: string) => DESIGN_FILE.test(name);

export async function saveDesignFile(id: string, name: string, bytes: Buffer | string) {
  if (!isId(id) || !isDesignFile(name)) throw new Error("Invalid design file");
  await write(`designs/${id}/${name}`, bytes, name.endsWith(".png") ? "image/png" : "application/json");
}

export async function readDesignFile(id: string, name: string) {
  if (!isId(id) || !isDesignFile(name)) return null;
  return (await read(`designs/${id}/${name}`))?.bytes ?? null;
}
