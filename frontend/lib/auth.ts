import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "./api";

export type User = { id: number; email: string; name: string; role: "customer" | "restaurant_admin" | "super_admin"; restaurant_id: number | null; email_verified: number; lang: string | null };

/** The signed-in user (asked from the backend once per request), or null. */
export const getUser = cache(async (): Promise<User | null> => {
  if (!(await cookies()).get("session")) return null;
  const r = await api.get<{ user: User | null }>("/api/me");
  return r.ok ? r.data.user : null;
});

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

/** Store the session token the backend issued (login/register). */
export async function setSession(token: string, maxAge: number) {
  (await cookies()).set("session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge, secure: process.env.NODE_ENV === "production" });
}
export async function clearSession() { (await cookies()).delete("session"); }
