import { randomUUID } from "node:crypto";
import { UPLOAD_TYPES, saveUpload, sniffImage as sniff } from "@/lib/files";
import { MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/limits";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    return Response.json({ error: `Images must be ${MAX_UPLOAD_MB} MB or smaller.` }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: `Images must be ${MAX_UPLOAD_MB} MB or smaller.` }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !(type in UPLOAD_TYPES)) {
    return Response.json({ error: "Please upload a PNG, JPG, WEBP or GIF image." }, { status: 415 });
  }

  const id = randomUUID();
  try {
    await saveUpload(id, type, bytes);
  } catch (e) {
    console.error("Failed to save upload", e);
    return Response.json({ error: "We couldn't upload your image right now. Please try again." }, { status: 500 });
  }
  return Response.json({ id, url: `/api/uploads/${id}` });
}
