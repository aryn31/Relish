import { backendUrl } from "@/lib/api";
export const dynamic = "force-dynamic";
/** Health check for the hosting platform: 200 when this site and the backend API (and its database) are up. */
export async function GET() {
  try {
    const r = await fetch(`${backendUrl()}/api/health`, { cache: "no-store" });
    return Response.json({ ok: r.ok, backend: r.ok }, { status: r.ok ? 200 : 503 });
  } catch { return Response.json({ ok: false, backend: false }, { status: 503 }); }
}
