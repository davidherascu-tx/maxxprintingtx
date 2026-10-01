import { readDesignFile } from "@/lib/files";

export async function GET(_: Request, ctx: RouteContext<"/api/designs/[id]/[file]">) {
  const { id, file } = await ctx.params;
  const bytes = await readDesignFile(id, file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.endsWith(".png") ? "image/png" : "application/json",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
