"use server";
import { api } from "@/lib/api";
import { done } from "@/lib/act";
import { go } from "@/lib/flash";

type In = { portionId: number; qty: number };
export type CheckedLine = { portionId: number; itemName: string; portionName: string; price: number; qty: number; ok: boolean };
export type CheckResult = { open: boolean; lines: CheckedLine[]; tables: { id: number; name: string }[]; total: number };

/** Revalidate a cart against current server data (MENU-06/07/08, CART-05). */
export async function checkCart(restaurantId: number, lines: In[]): Promise<CheckResult> {
  const r = await api.post<CheckResult>("/api/cart/check", { restaurantId, lines });
  if (!r.ok) return { open: false, lines: [], tables: [], total: 0 };
  return { open: r.data.open, lines: r.data.lines, tables: r.data.tables, total: r.data.total };
}

export type PlaceResult = { error: string } | { publicId: string };

export async function placeOrder(input: { restaurantId: number; lines: (In & { expectedPrice: number })[]; tableId: number; method: "upi" | "cash"; idem: string }): Promise<PlaceResult> {
  const r = await api.post<{ publicId: string }>("/api/orders", input);
  if (!r.ok || !r.data.publicId) return { error: r.data.error ?? "Something went wrong. Please try again." };
  return { publicId: r.data.publicId };
}

/** Finish an order action: not signed in → sign-in page; order not found → /orders. */
function finish(r: Awaited<ReturnType<typeof api.post>>, pid: string): never {
  if (r.status === 401) go(`/login?next=/orders/${pid}`);
  done(r, `/orders/${pid}`);
}

export async function reportPaid(fd: FormData) {
  const pid = String(fd.get("pid") || "");
  finish(await api.post(`/api/orders/${encodeURIComponent(pid)}/paid`), pid);
}
export async function switchMethod(fd: FormData) {
  const pid = String(fd.get("pid") || "");
  finish(await api.post(`/api/orders/${encodeURIComponent(pid)}/method`, { method: String(fd.get("method")) }), pid);
}
export async function requestCancel(fd: FormData) {
  const pid = String(fd.get("pid") || "");
  finish(await api.post(`/api/orders/${encodeURIComponent(pid)}/cancel`, { reason: String(fd.get("reason") || "") }), pid);
}
