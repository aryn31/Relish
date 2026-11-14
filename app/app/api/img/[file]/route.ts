import { readUpload } from "@/lib/files";
import { db } from "@/lib/db";
// Menu item images are public, but only if they belong to an item (UPI QR files are never served here).
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!await db.prepare("SELECT 1 FROM items WHERE image=?").get(file)) return new Response("Not found", { status: 404 });
  const f = readUpload(file);
  return f ? new Response(new Uint8Array(f.buf), { headers: { "content-type": f.type, "cache-control": "public, max-age=86400" } }) : new Response("Not found", { status: 404 });
}
