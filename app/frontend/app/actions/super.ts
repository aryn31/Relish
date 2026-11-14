"use server";
import { api } from "@/lib/api";
import { done } from "@/lib/act";

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
/** Id for a URL path segment ("0" when missing, which the backend treats as not found). */
const pid = (fd: FormData, k: string) => encodeURIComponent(s(fd, k) || "0");
const appBack = (fd: FormData) => `/super/apps/${s(fd, "app_id")}`;

export async function assignFee(fd: FormData) {
  done(await api.post(`/api/super/applications/${pid(fd, "app_id")}/fee`, { amount: s(fd, "amount") }), appBack(fd));
}
export async function confirmFee(fd: FormData) {
  done(await api.post(`/api/super/applications/${pid(fd, "app_id")}/fee/confirm`), appBack(fd));
}
export async function decideApplication(fd: FormData) {
  done(await api.post(`/api/super/applications/${pid(fd, "app_id")}/decision`, { decision: s(fd, "decision"), reason: s(fd, "reason") }), appBack(fd));
}

export async function activateRestaurant(fd: FormData) {
  done(await api.post(`/api/super/restaurants/${pid(fd, "id")}/activate`), "/super/restaurants");
}
export async function deactivateRestaurant(fd: FormData) {
  done(await api.post(`/api/super/restaurants/${pid(fd, "id")}/deactivate`, { reason: s(fd, "reason") }), "/super/restaurants");
}

export async function createAdmin(fd: FormData) {
  done(await api.post("/api/super/admins", { restaurant_id: s(fd, "restaurant_id"), email: s(fd, "email"), name: s(fd, "name") }), "/super/admins");
}
export async function toggleAdmin(fd: FormData) {
  done(await api.post(`/api/super/admins/${pid(fd, "id")}/toggle`), "/super/admins");
}
export async function recoverAdmin(fd: FormData) {
  done(await api.post(`/api/super/admins/${pid(fd, "id")}/recover`), "/super/admins");
}

export async function supportRevertPayment(fd: FormData) {
  done(await api.post(`/api/super/orders/${pid(fd, "id")}/revert-payment`, { note: s(fd, "note") }), "/super/orders");
}
export async function saveSettings(fd: FormData) {
  done(await api.post("/api/super/settings", { max_pending: fd.get("max_pending") === null ? "" : String(fd.get("max_pending")) }), "/super");
}
