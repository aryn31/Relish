import { readUpload } from "@/lib/files";
import { getUser } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
// The restaurant's own admins can preview the UPI QR they uploaded.
export async function GET() {
  const u = await getUser();
  if (!u || u.role !== "restaurant_admin" || !u.restaurant_id) return new Response("Forbidden", { status: 403 });
  const r = await getRestaurant(u.restaurant_id);
  const f = r?.upi_qr ? readUpload(r.upi_qr) : null;
  return f ? new Response(new Uint8Array(f.buf), { headers: { "content-type": f.type, "cache-control": "private, no-store" } }) : new Response("Not found", { status: 404 });
}
