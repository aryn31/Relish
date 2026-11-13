"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db, log, rateOk } from "@/lib/db";
import { startSession, endSession, getUser, newToken, useToken, strongPassword } from "@/lib/auth";
import { sendMail, baseUrl } from "@/lib/mail";
import { go } from "@/lib/flash";

const ip = async () => (await headers()).get("x-forwarded-for") ?? "local";
const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
const landing = (role: string, next: string) => next !== "/" ? next : role === "super_admin" ? "/super" : role === "restaurant_admin" ? "/admin" : "/";

export async function signOut() { await endSession(); go("/"); }

export async function login(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase(), pw = String(fd.get("password") || "");
  const next = safeNext(String(fd.get("next") || "/"));
  if (!rateOk(`login:${await ip()}`, 20, 600) || !rateOk(`login:${email}`, 8, 600)) go("/login", "Too many attempts. Please wait a few minutes.", true);
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email) as { id: number; password_hash: string | null; role: string; disabled: number; session_version: number } | undefined;
  const ok = u && u.password_hash && !u.disabled && (await bcrypt.compare(pw, u.password_hash));
  if (!ok) go(`/login?next=${encodeURIComponent(next)}`, "Email or password is incorrect.", true);
  await startSession(u!);
  go(landing(u!.role, next));
}

export async function registerCustomer(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase(), name = String(fd.get("name") || "").trim(), pw = String(fd.get("password") || "");
  const next = safeNext(String(fd.get("next") || "/"));
  const back = `/register?next=${encodeURIComponent(next)}`;
  if (!rateOk(`reg:${await ip()}`, 10, 600)) go(back, "Too many attempts. Please wait a few minutes.", true);
  if (!/^\S+@\S+\.\S+$/.test(email)) go(back, "Please enter a valid email address.", true);
  if (!name) go(back, "Please enter your name.", true);
  if (!strongPassword(pw)) go(back, "Password must be at least 8 characters and include a letter and a number.", true);
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (exists) go(back, "We could not create this account. Try signing in or resetting your password.", true); // no enumeration detail
  const r = db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'customer')").run(email, name, bcrypt.hashSync(pw, 10));
  await startSession({ id: Number(r.lastInsertRowid), session_version: 0 });
  go(next);
}

export async function forgot(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (rateOk(`forgot:${await ip()}`, 5, 600)) {
    const u = db.prepare("SELECT id FROM users WHERE email=? AND password_hash IS NOT NULL AND disabled=0").get(email) as { id: number } | undefined;
    if (u) sendMail(email, "Reset your password", `Reset link (valid 2 hours): ${baseUrl()}/reset?token=${newToken(u.id, "reset", 2)}`);
  }
  go("/forgot", "If that email has an account, a reset link has been sent.");
}

export async function resetPassword(fd: FormData) {
  const token = String(fd.get("token") || ""), pw = String(fd.get("password") || "");
  if (!strongPassword(pw)) go(`/reset?token=${token}`, "Password must be at least 8 characters and include a letter and a number.", true);
  const uid = useToken(token, "reset");
  if (!uid) go("/forgot", "This reset link is invalid or expired.", true);
  db.prepare("UPDATE users SET password_hash=?, session_version=session_version+1 WHERE id=?").run(bcrypt.hashSync(pw, 10), uid);
  go("/login", "Password updated. Please sign in.");
}

export async function updateProfile(fd: FormData) {
  const u = await getUser(); if (!u) go("/login");
  const name = String(fd.get("name") || "").trim();
  if (name) db.prepare("UPDATE users SET name=? WHERE id=?").run(name, u.id);
  go(String(fd.get("back") || "/"), "Saved.");
}

export async function deleteMyAccount() {
  const u = await getUser(); if (!u || u.role !== "customer") go("/");
  // AUTH-09: anonymize, keep order records
  db.prepare("UPDATE users SET name='Deleted customer', email=?, password_hash=NULL, google_id=NULL, disabled=1 WHERE id=?").run(`deleted-${u.id}@invalid.local`, u.id);
  log(u.id, "account_deleted");
  await endSession(); go("/", "Your account has been deleted.");
}
