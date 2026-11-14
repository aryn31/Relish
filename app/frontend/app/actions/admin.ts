"use server";
import { redirect } from "next/navigation";
import { api, type ApiRes } from "@/lib/api";
import { done } from "@/lib/act";

// Restaurant admin dashboard actions. All rules (restaurant scoping, approval gating, activation,
// validation) live in the backend (/api/admin/*); these only forward the form and redirect.

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
const n = (fd: FormData, k: string) => Number(fd.get(k));

/** Finish the action. A signed-in user who is not a restaurant admin goes home (as before). */
function fin(r: ApiRes<unknown>, back: string): never {
  if (r.status === 403 && !r.data.redirect) redirect("/");
  done(r, back);
}

// ---------- Categories ----------
export async function addCategory(fd: FormData) {
  fin(await api.post("/api/admin/categories", { name: s(fd, "name") }), "/admin/menu");
}
export async function renameCategory(fd: FormData) {
  fin(await api.patch(`/api/admin/categories/${n(fd, "id")}`, { name: s(fd, "name") }), "/admin/menu");
}
export async function moveCategory(fd: FormData) {
  fin(await api.post(`/api/admin/categories/${n(fd, "id")}/move`, { dir: s(fd, "dir") }), "/admin/menu");
}
export async function deleteCategory(fd: FormData) {
  fin(await api.del(`/api/admin/categories/${n(fd, "id")}`), "/admin/menu");
}

// ---------- Items ----------
export async function saveItem(fd: FormData) {
  // Repeated fields (plabel/pprice/punavail) travel as one JSON field so their order is unambiguous.
  const data = {
    id: n(fd, "id") || 0, name: s(fd, "name"), category_id: n(fd, "category_id"), description: s(fd, "description"), veg: s(fd, "veg"),
    available: fd.get("available") ? 1 : 0,
    plabel: fd.getAll("plabel").map(String), pprice: fd.getAll("pprice").map(String), punavail: fd.getAll("punavail").map(String),
  };
  const body = new FormData();
  body.set("data", JSON.stringify(data));
  const f = fd.get("image");
  if (f instanceof File && f.size > 0) body.set("image", f, f.name || "image");
  fin(await api.form("/api/admin/items", body), "/admin/menu");
}
export async function toggleItem(fd: FormData) {
  fin(await api.post(`/api/admin/items/${n(fd, "id")}/toggle`), "/admin/menu");
}
export async function deleteItem(fd: FormData) {
  fin(await api.del(`/api/admin/items/${n(fd, "id")}`), "/admin/menu");
}

// ---------- Tables ----------
export async function addTable(fd: FormData) {
  fin(await api.post("/api/admin/tables", { name: s(fd, "name") }), "/admin/tables");
}
export async function renameTable(fd: FormData) {
  fin(await api.patch(`/api/admin/tables/${n(fd, "id")}`, { name: s(fd, "name") }), "/admin/tables");
}
export async function toggleTable(fd: FormData) {
  fin(await api.post(`/api/admin/tables/${n(fd, "id")}/toggle`), "/admin/tables");
}

// ---------- Restaurant info / UPI ----------
export async function saveInfo(fd: FormData) {
  const body = Object.fromEntries(["name", "description", "address", "phone", "type", "fssai", "gstin"].map((k) => [k, s(fd, k)]));
  fin(await api.patch("/api/admin/info", body), "/admin/info");
}
export async function uploadUpi(fd: FormData) {
  const body = new FormData();
  const f = fd.get("upi");
  if (f instanceof File && f.size > 0) body.set("upi", f, f.name || "upi");
  fin(await api.form("/api/admin/upi", body), "/admin/payments");
}

// ---------- Orders ----------
const back = (fd: FormData) => { const b = s(fd, "back"); return b.startsWith("/admin") ? b : "/admin/orders"; };
const order = async (fd: FormData, action: string, body: Record<string, unknown> = {}) =>
  fin(await api.post(`/api/admin/orders/${n(fd, "id")}/${action}`, body), back(fd));

export async function setPrep(fd: FormData) { await order(fd, "prep", { minutes: String(fd.get("minutes") ?? "") }); }
export async function completeOrder(fd: FormData) { await order(fd, "complete"); }
export async function confirmPayment(fd: FormData) { await order(fd, "pay"); }
export async function decideCancel(fd: FormData) { await order(fd, "cancel-decision", { decision: s(fd, "decision") }); }
export async function reassignTable(fd: FormData) { await order(fd, "table", { table_id: String(fd.get("table_id") ?? "") }); }
