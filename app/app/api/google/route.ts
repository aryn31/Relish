import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { baseUrl } from "@/lib/mail";

// Google OAuth (customers). Enabled when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set.
// Redirect URI to register in Google console: {BASE_URL}/api/google
export async function GET(req: NextRequest) {
  const id = process.env.GOOGLE_CLIENT_ID, sec = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !sec) return new NextResponse("Google sign-in is not configured", { status: 404 });
  const redirect_uri = `${baseUrl()}/api/google`;
  const code = req.nextUrl.searchParams.get("code");
  const jar = await cookies();
  if (!code) {
    const state = crypto.randomBytes(16).toString("hex");
    const next = req.nextUrl.searchParams.get("next") || "/";
    jar.set("oauth", JSON.stringify({ state, next }), { httpOnly: true, maxAge: 600, path: "/", sameSite: "lax" });
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({ client_id: id, redirect_uri, response_type: "code", scope: "openid email profile", state }).toString();
    return NextResponse.redirect(u);
  }
  const saved = JSON.parse(jar.get("oauth")?.value || "{}");
  if (!saved.state || saved.state !== req.nextUrl.searchParams.get("state")) return new NextResponse("Invalid state", { status: 400 });
  const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: sec, redirect_uri, grant_type: "authorization_code" }) })).json();
  const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
  if (!info.email || !info.email_verified) return new NextResponse("Google email not verified", { status: 400 });
  const email = String(info.email).toLowerCase();
  let u = await db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
  if (u && u.role !== "customer") return new NextResponse("This email belongs to a restaurant/admin account. Use password sign-in.", { status: 400 });
  if (!u) {
    const r = await db.prepare("INSERT INTO users(email,name,role,email_verified,google_id) VALUES(?,?,'customer',1,?)").run(email, info.name || email, info.sub);
    u = await db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid);
  } else if (!u.email_verified && u.password_hash) {
    // Unverified password account with same email: drop its password so a squatter cannot take over the Google-verified owner (AUTH-04/06).
    await db.prepare("UPDATE users SET password_hash=NULL, email_verified=1, google_id=?, session_version=session_version+1 WHERE id=?").run(info.sub, u.id);
    u = await db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
  } else if (!u.google_id) {
    await db.prepare("UPDATE users SET google_id=?, email_verified=1 WHERE id=?").run(info.sub, u.id);
  }
  await startSession(u);
  jar.delete("oauth");
  const next = typeof saved.next === "string" && saved.next.startsWith("/") && !saved.next.startsWith("//") ? saved.next : "/";
  return NextResponse.redirect(new URL(next, baseUrl()));
}
