import { readUpload } from "@/lib/files";

export async function GET(_: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  const { id } = await ctx.params;
  const file = await readUpload(id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
