"use server";
import { api } from "@/lib/api";
import { done } from "@/lib/act";
import { setSession, clearSession } from "@/lib/auth";
import { go } from "@/lib/flash";

type Session = { token: string; maxAge: number; role: string };
const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
const landing = (role: string, next: string) => next !== "/" ? next : role === "super_admin" ? "/super" : role === "restaurant_admin" ? "/admin" : "/";
const ERR = "Something went wrong. Please try again.";

export async function signOut() { await api.post("/api/auth/logout"); await clearSession(); go("/"); }

export async function login(fd: FormData) {
  const next = safeNext(String(fd.get("next") || "/"));
  const r = await api.post<Session>("/api/auth/login", { email: String(fd.get("email") || ""), password: String(fd.get("password") || "") });
  if (!r.ok) go(r.data.redirect ?? `/login?next=${encodeURIComponent(next)}`, r.data.error ?? ERR, true);
  await setSession(r.data.token, r.data.maxAge);
  go(landing(r.data.role, next));
}

export async function registerCustomer(fd: FormData) {
  const next = safeNext(String(fd.get("next") || "/"));
  const back = `/register?next=${encodeURIComponent(next)}`;
  const r = await api.post<Session>("/api/auth/register", { email: String(fd.get("email") || ""), name: String(fd.get("name") || ""), password: String(fd.get("password") || "") });
  if (!r.ok) go(back, r.data.error ?? ERR, true);
  await setSession(r.data.token, r.data.maxAge);
  go(next);
}

export async function forgot(fd: FormData) {
  const r = await api.post("/api/auth/forgot", { email: String(fd.get("email") || "") });
  done(r, "/forgot");
}

export async function resetPassword(fd: FormData) {
  const token = String(fd.get("token") || ""), pw = String(fd.get("password") || "");
  const r = await api.post("/api/auth/reset", { token, password: pw });
  done(r, `/reset?token=${token}`, "/login");
}

export async function updateProfile(fd: FormData) {
  const r = await api.patch("/api/me", { name: String(fd.get("name") || "") });
  if (r.status === 401) go("/login");
  done(r, String(fd.get("back") || "/"));
}

export async function deleteMyAccount() {
  const r = await api.del("/api/me");
  if (!r.ok) go("/");
  await clearSession(); go("/", r.data.message);
}
