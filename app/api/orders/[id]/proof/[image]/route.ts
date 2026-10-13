import { findOrder } from "@/lib/db";
import { readProofImage } from "@/lib/files";
import { getCurrentUser } from "@/lib/session";
import { getCurrentStaff } from "@/lib/staff-session";

/** A proof image: only staff and the customer who placed the order may see it. */
export async function GET(_: Request, ctx: RouteContext<"/api/orders/[id]/proof/[image]">) {
  const { id, image } = await ctx.params;
  const [staff, user] = await Promise.all([getCurrentStaff(), getCurrentUser()]);
  if (!staff) {
    const order = user ? await findOrder(id) : undefined;
    if (!order || order.userId !== user?.id) return new Response("Not found", { status: 404 });
  }
  const file = await readProofImage(id, image);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
