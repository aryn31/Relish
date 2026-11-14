import { Router } from "express";
import crypto from "crypto";
import { db } from "../db";
import { issueSession } from "../auth";
import { baseUrl } from "../mail";

// Google OAuth (customers). Enabled when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set.
// The browser reaches this through the frontend's /api proxy, so the redirect URI to register
// in the Google console is {BASE_URL}/api/google (BASE_URL = the public site address).
export const router = Router();

router.get("/google", async (req, res) => {
  const id = process.env.GOOGLE_CLIENT_ID, sec = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !sec) { res.status(404).send("Google sign-in is not configured"); return; }
  const redirect_uri = `${baseUrl()}/api/google`;
  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    const state = crypto.randomBytes(16).toString("hex");
    const next = typeof req.query.next === "string" ? req.query.next : "/";
    res.cookie("oauth", JSON.stringify({ state, next }), { httpOnly: true, maxAge: 600_000, path: "/", sameSite: "lax" });
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({ client_id: id, redirect_uri, response_type: "code", scope: "openid email profile", state }).toString();
    res.redirect(u.toString()); return;
  }
  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(req.cookies?.oauth || "{}"); } catch { /* ignore */ }
  if (!saved.state || saved.state !== req.query.state) { res.status(400).send("Invalid state"); return; }
  const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: sec, redirect_uri, grant_type: "authorization_code" }) })).json() as { access_token?: string };
  const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } })).json() as { email?: string; email_verified?: boolean; name?: string; sub?: string };
  if (!info.email || !info.email_verified) { res.status(400).send("Google email not verified"); return; }
  const email = String(info.email).toLowerCase();
  type Row = { id: number; role: string; email_verified: number; password_hash: string | null; google_id: string | null; session_version: number };
  let u = (await db.prepare("SELECT * FROM users WHERE email=?").get(email)) as Row | undefined;
  if (u && u.role !== "customer") { res.status(400).send("This email belongs to a restaurant/admin account. Use password sign-in."); return; }
  if (!u) {
    const r = await db.prepare("INSERT INTO users(email,name,role,email_verified,google_id) VALUES(?,?,'customer',1,?)").run(email, info.name || email, info.sub);
    u = (await db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid)) as Row;
  } else if (!u.email_verified && u.password_hash) {
    // Unverified password account with same email: drop its password so a squatter cannot take over the Google-verified owner (AUTH-04/06).
    await db.prepare("UPDATE users SET password_hash=NULL, email_verified=1, google_id=?, session_version=session_version+1 WHERE id=?").run(info.sub, u.id);
    u = (await db.prepare("SELECT * FROM users WHERE id=?").get(u.id)) as Row;
  } else if (!u.google_id) {
    await db.prepare("UPDATE users SET google_id=?, email_verified=1 WHERE id=?").run(info.sub, u.id);
  }
  await issueSession(res, u);
  res.clearCookie("oauth", { path: "/" });
  const next = typeof saved.next === "string" && saved.next.startsWith("/") && !saved.next.startsWith("//") ? saved.next : "/";
  res.redirect(new URL(next, baseUrl()).toString());
});
