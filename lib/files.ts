import "server-only";
import { del, get, list, put } from "@vercel/blob";

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
// Vercel rejects request bodies over 4.5 MB, so uploads stay under that with room for form overhead.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4.5 * 1000 * 1000;

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

/** Design files: `design.json`, `<side>-preview.png`, `<side>-print.png`, `<side>-cut.svg`. */
const DESIGN_FILE = /^(design\.json|[a-z]+-(preview|print)\.png|[a-z]+-cut\.svg)$/;
export const isDesignFile = (name: string) => DESIGN_FILE.test(name);
/** Only previews are public; print and cut files are production files for the owner and staff. */
export const isPublicDesignFile = (name: string) => name.endsWith("-preview.png");

export const designFileType = (name: string) =>
  name.endsWith(".png") ? "image/png" : name.endsWith(".svg") ? "image/svg+xml" : "application/json";

export async function saveDesignFile(id: string, name: string, bytes: Buffer | string) {
  if (!isId(id) || !isDesignFile(name)) throw new Error("Invalid design file");
  await write(`designs/${id}/${name}`, bytes, designFileType(name));
}

export async function readDesignFile(id: string, name: string) {
  if (!isId(id) || !isDesignFile(name)) return null;
  return (await read(`designs/${id}/${name}`))?.bytes ?? null;
}

export async function deleteDesignFiles(id: string) {
  if (!isId(id)) return;
  const { blobs } = await list({ prefix: `designs/${id}/` });
  if (blobs.length) await del(blobs.map((b) => b.url));
}
