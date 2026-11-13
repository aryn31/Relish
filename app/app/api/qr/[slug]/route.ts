import QRCode from "qrcode";
import { getUser } from "@/lib/auth";
import { getBySlug } from "@/lib/restaurant";
import { baseUrl } from "@/lib/mail";
// QR-01/02: stable URL /r/{slug}. Only that restaurant's admins (or super admin) may download.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const u = await getUser(); const r = getBySlug(slug);
  if (!u || !r || !(u.role === "super_admin" || (u.role === "restaurant_admin" && u.restaurant_id === r.id))) return new Response("Forbidden", { status: 403 });
  const png = await QRCode.toBuffer(`${baseUrl()}/r/${r.slug}`, { width: 800, margin: 2 });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "content-disposition": `attachment; filename="${r.slug}-menu-qr.png"` } });
}
