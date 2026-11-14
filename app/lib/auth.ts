import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { db } from "./db";

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret");
export type User = { id: number; email: string; name: string; role: "customer" | "restaurant_admin" | "super_admin"; restaurant_id: number | null; email_verified: number; disabled: number; lang: string | null; session_version: number };

export async function startSession(u: { id: number; session_version: number }) {
  const jwt = await new SignJWT({ uid: u.id, v: u.session_version }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
  (await cookies()).set("session", jwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production" });
}
export async function endSession() { (await cookies()).delete("session"); }

export async function getUser(): Promise<User | null> {
  const c = (await cookies()).get("session")?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    const u = await db.prepare("SELECT id,email,name,role,restaurant_id,email_verified,disabled,lang,session_version FROM users WHERE id=?").get(payload.uid) as User | undefined;
    if (!u || u.disabled || u.session_version !== payload.v) return null;
    return u;
  } catch { return null; }
}

export async function requireUser(next = "/"): Promise<User> {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}
export async function requireSuper(): Promise<User> {
  const u = await requireUser("/super");
  if (u.role !== "super_admin") redirect("/");
  return u;
}
export async function requireRestAdmin(): Promise<User & { restaurant_id: number }> {
  const u = await requireUser("/admin");
  if (u.role !== "restaurant_admin" || !u.restaurant_id) redirect("/");
  return u as User & { restaurant_id: number };
}

export async function newToken(userId: number, kind: "verify" | "reset", hours = 24) {
  const token = crypto.randomBytes(24).toString("hex");
  await db.prepare("INSERT INTO tokens VALUES(?,?,?,datetime('now',?))").run(token, userId, kind, `+${hours} hours`);
  return token;
}
export async function useToken(token: string, kind: string): Promise<number | null> {
  const r = await db.prepare("SELECT user_id FROM tokens WHERE token=? AND kind=? AND expires_at>datetime('now')").get(token, kind) as { user_id: number } | undefined;
  if (!r) return null;
  await db.prepare("DELETE FROM tokens WHERE token=?").run(token);
  return r.user_id;
}

export const strongPassword = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
