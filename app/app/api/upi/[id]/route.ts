import { readUpload } from "@/lib/files";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
// PAY-08: UPI QR is only served to the order's customer, the restaurant's admins, or the super admin.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const u = await getUser();
  if (!u) return new Response("Forbidden", { status: 403 });
  const o = await db.prepare("SELECT o.customer_id, o.restaurant_id, r.upi_qr FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.public_id=?").get(id) as { customer_id: number; restaurant_id: number; upi_qr: string | null } | undefined;
  if (!o || !o.upi_qr) return new Response("Not found", { status: 404 });
  const allowed = u.id === o.customer_id || u.role === "super_admin" || (u.role === "restaurant_admin" && u.restaurant_id === o.restaurant_id);
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const f = readUpload(o.upi_qr);
  return f ? new Response(new Uint8Array(f.buf), { headers: { "content-type": f.type, "cache-control": "private, no-store" } }) : new Response("Not found", { status: 404 });
}
