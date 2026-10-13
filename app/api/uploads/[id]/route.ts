import { deleteUpload, isId, readUpload } from "@/lib/files";

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

/** Remove an uploaded image from storage. Upload ids are unguessable, so only the uploader can delete one. */
export async function DELETE(_: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  const { id } = await ctx.params;
  if (!isId(id)) return new Response("Not found", { status: 404 });
  try {
    await deleteUpload(id);
  } catch (e) {
    console.error("Failed to delete upload", e);
    return Response.json({ error: "We couldn't delete that image. Please try again." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
