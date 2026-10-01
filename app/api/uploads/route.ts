import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, saveUpload } from "@/lib/files";

// Check the file's magic bytes so the declared type can't be spoofed.
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 4).toString() === "GIF8") return "image/gif";
  return null;
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Images must be 20 MB or smaller." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !(type in UPLOAD_TYPES)) {
    return Response.json({ error: "Please upload a PNG, JPG, WEBP or GIF image." }, { status: 415 });
  }

  const id = randomUUID();
  await saveUpload(id, type, bytes);
  return Response.json({ id, url: `/api/uploads/${id}` });
}
