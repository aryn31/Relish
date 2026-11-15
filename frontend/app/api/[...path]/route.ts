import type { NextRequest } from "next/server";
import { backendUrl } from "@/lib/api";

// Forwards browser requests for /api/* (images, UPI/menu QR codes, Google sign-in…) to the backend,
// so the browser only ever talks to this site: one origin, no CORS, cookies just work.
// More specific routes in app/api (lang, health) take precedence over this catch-all.
export const dynamic = "force-dynamic";
const PASS_REQ = ["cookie", "content-type", "accept", "user-agent", "accept-language", "range"];
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "set-cookie"]);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${backendUrl()}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  for (const k of PASS_REQ) { const v = req.headers.get(k); if (v) headers.set(k, v); }
  const fwd = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  if (fwd) headers.set("x-forwarded-for", fwd);
  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers, redirect: "manual", cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") { init.body = req.body; init.duplex = "half"; }
  let res: Response;
  try { res = await fetch(target, init); }
  catch { return Response.json({ error: "The service is temporarily unavailable. Please try again." }, { status: 503 }); }
  const out = new Headers();
  res.headers.forEach((v, k) => { if (!DROP_RES.has(k)) out.set(k, v); });
  for (const c of res.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD };
