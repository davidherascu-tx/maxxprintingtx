import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uploaded artwork and rendered design files, stored in a private Supabase Storage bucket.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only). The bucket must exist and be
// private (see README). Files are served through our own /api routes, never by direct URL.

const BUCKET = "files";

let supabase: ReturnType<typeof createClient> | undefined;
function storage() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabase.storage.from(BUCKET);
}

export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
// Request bodies stay small so uploads work on any host; this leaves room for form overhead.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4.5 * 1000 * 1000;

const ID = /^[0-9a-f-]{36}$/;
export const isId = (id: string) => ID.test(id);

async function write(pathname: string, body: Buffer | string, contentType: string) {
  const { error } = await storage().upload(pathname, body, { contentType, upsert: true });
  if (error) throw error;
}

async function read(pathname: string) {
  const { data, error } = await storage().download(pathname);
  if (error || !data) return null;
  return { bytes: Buffer.from(await data.arrayBuffer()), type: data.type };
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
  const { data } = await storage().list(`designs/${id}`);
  if (data?.length) await storage().remove(data.map((f) => `designs/${id}/${f.name}`));
}
