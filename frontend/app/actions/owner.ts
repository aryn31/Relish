"use server";
import { api, type ApiRes } from "@/lib/api";
import { done } from "@/lib/act";
import { setSession } from "@/lib/auth";
import { go } from "@/lib/flash";

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();

/** Owner actions: not signed in → sign-in (back to /admin); not a restaurant admin → home. */
function finish(r: ApiRes<unknown>, okTo?: string): never {
  if (r.status === 403) go("/");
  done(r, "/admin", okTo);
}

export async function registerRestaurant(fd: FormData) {
  const back = "/owner/register";
  const body = Object.fromEntries(["email", "password", "name", "owner", "address", "phone", "type", "fssai", "gstin"].map((k) => [k, s(fd, k)]));
  const r = await api.post<{ token: string; maxAge: number }>("/api/owner/register", body);
  if (!r.ok) go(back, r.data.error ?? "Something went wrong. Please try again.", true);
  await setSession(r.data.token, r.data.maxAge);
  go("/admin", r.data.message);
}

export async function resendVerification() { finish(await api.post("/api/owner/resend-verification")); }

export async function submitApplication() { finish(await api.post("/api/owner/submit")); }

export async function startNewApplication() { finish(await api.post("/api/owner/new-application")); }

export async function markReviewed() { finish(await api.post("/api/owner/reviewed")); }
