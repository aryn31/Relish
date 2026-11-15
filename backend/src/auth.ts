import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { db } from "./db";
import { fail } from "./http";

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret");
export type User = { id: number; email: string; name: string; role: "customer" | "restaurant_admin" | "super_admin"; restaurant_id: number | null; email_verified: number; disabled: number; lang: string | null; session_version: number };
export const SESSION_MAX_AGE = 7 * 86400;

/** Create a session token. Returned in the JSON body (for the frontend server) and also set as a cookie (for browser requests via the proxy). */
export async function issueSession(res: Response, u: { id: number; session_version: number }) {
  const token = await new SignJWT({ uid: u.id, v: u.session_version }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
  res.cookie("session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE * 1000, secure: process.env.NODE_ENV === "production" });
  return { token, maxAge: SESSION_MAX_AGE };
}
export function clearSession(res: Response) { res.clearCookie("session", { path: "/" }); }

const cache = new WeakMap<Request, User | null>();
export async function currentUser(req: Request): Promise<User | null> {
  if (cache.has(req)) return cache.get(req)!;
  let u: User | null = null;
  const c = req.cookies?.session as string | undefined;
  if (c) {
    try {
      const { payload } = await jwtVerify(c, secret());
      const row = (await db.prepare("SELECT id,email,name,role,restaurant_id,email_verified,disabled,lang,session_version FROM users WHERE id=?").get(payload.uid)) as User | undefined;
      if (row && !row.disabled && row.session_version === payload.v) u = row;
    } catch { /* invalid or expired */ }
  }
  cache.set(req, u);
  return u;
}
export async function requireUser(req: Request): Promise<User> {
  const u = await currentUser(req);
  return u ?? fail("Please sign in.", 401);
}
export async function requireRestAdmin(req: Request): Promise<User & { restaurant_id: number }> {
  const u = await requireUser(req);
  if (u.role !== "restaurant_admin" || !u.restaurant_id) fail("Not allowed.", 403);
  return u as User & { restaurant_id: number };
}
export async function requireSuper(req: Request): Promise<User> {
  const u = await requireUser(req);
  if (u.role !== "super_admin") fail("Not allowed.", 403);
  return u;
}

export async function newToken(userId: number, kind: "verify" | "reset", hours = 24) {
  const token = crypto.randomBytes(24).toString("hex");
  await db.prepare("INSERT INTO tokens VALUES(?,?,?,datetime('now',?))").run(token, userId, kind, `+${hours} hours`);
  return token;
}
export async function useToken(token: string, kind: string): Promise<number | null> {
  const r = (await db.prepare("SELECT user_id FROM tokens WHERE token=? AND kind=? AND expires_at>datetime('now')").get(token, kind)) as { user_id: number } | undefined;
  if (!r) return null;
  await db.prepare("DELETE FROM tokens WHERE token=?").run(token);
  return r.user_id;
}

/** Owner email verification. Off by default. Set EMAIL_VERIFICATION_ENABLED=true to bring it back. */
export const emailVerificationEnabled = () => process.env.EMAIL_VERIFICATION_ENABLED === "true";
export const strongPassword = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
/** Public view of a user (no internal fields). */
export const publicUser = (u: User | null) => u && { id: u.id, email: u.email, name: u.name, role: u.role, restaurant_id: u.restaurant_id, email_verified: u.email_verified, lang: u.lang };
