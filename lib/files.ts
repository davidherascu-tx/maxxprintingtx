import "server-only";
import { AwsClient } from "aws4fetch";

// Uploaded artwork and rendered design files, stored in a private Neon Object Storage bucket
// (S3-compatible, path-style). Needs NEON_S3_ENDPOINT, NEON_S3_REGION, NEON_S3_ACCESS_KEY_ID and
// NEON_S3_SECRET_ACCESS_KEY (server only); see README. Files are served through our own /api
// routes, never by direct URL.

const BUCKET = "files";

let aws: AwsClient | undefined;
function objectUrl(path = "") {
  const endpoint = process.env.NEON_S3_ENDPOINT;
  if (!endpoint) throw new Error("NEON_S3_ENDPOINT must be set");
  return `${endpoint.replace(/\/$/, "")}/${BUCKET}${path}`;
}

async function s3(path: string, init: RequestInit = {}) {
  if (!aws) {
    const accessKeyId = process.env.NEON_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.NEON_S3_SECRET_ACCESS_KEY;
    const region = process.env.NEON_S3_REGION;
    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error("NEON_S3_ACCESS_KEY_ID, NEON_S3_SECRET_ACCESS_KEY and NEON_S3_REGION must be set");
    }
    aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" });
  }
  return aws.fetch(objectUrl(path), init);
}

export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export { MAX_UPLOAD_BYTES, MAX_REQUEST_BYTES } from "./limits";

/** An image's real type from its first bytes (so a declared type can't be spoofed), or null. */
export function sniffImage(b: Buffer): string | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "GIF8") return "image/gif";
  return null;
}

const ID = /^[0-9a-f-]{36}$/;
export const isId = (id: string) => ID.test(id);

async function write(pathname: string, body: Buffer | string, contentType: string) {
  const data = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
  // An explicit length keeps larger bodies from being sent chunked, which the storage service rejects (501).
  const res = await s3(`/${pathname}`, {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(data.byteLength) },
    body: data,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`);
}

async function read(pathname: string) {
  const res = await s3(`/${pathname}`);
  if (!res.ok) return null;
  return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
}

export async function saveUpload(id: string, type: string, bytes: Buffer) {
  await write(`uploads/${id}`, bytes, type);
}

export async function readUpload(id: string) {
  if (!isId(id)) return null;
  return read(`uploads/${id}`);
}

export async function deleteUpload(id: string) {
  if (!isId(id)) return;
  const res = await s3(`/uploads/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
}

/** Proof images from the earlier customer-proof flow, still shown in old orders' history. */
export async function readProofImage(orderId: string, imageId: string) {
  if (!isId(orderId) || !isId(imageId)) return null;
  return read(`proofs/${orderId}/${imageId}`);
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
  const list = await s3(`?list-type=2&prefix=${encodeURIComponent(`designs/${id}/`)}`);
  if (!list.ok) return;
  const keys = [...(await list.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  await Promise.all(keys.map((key) => s3(`/${key}`, { method: "DELETE" })));
}
