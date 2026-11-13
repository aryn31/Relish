"use server";
import { db, log } from "@/lib/db";
import { requireSuper, newToken } from "@/lib/auth";
import { sendMail, baseUrl } from "@/lib/mail";
import { go } from "@/lib/flash";
import { getRestaurant, fee, checklist, maybeActivate } from "@/lib/restaurant";

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
const n = (fd: FormData, k: string) => Number(fd.get(k));
const ownerEmail = (rid: number) => (db.prepare("SELECT email FROM users WHERE restaurant_id=? AND role='restaurant_admin' ORDER BY id LIMIT 1").get(rid) as { email: string } | undefined)?.email;
const notify = (rid: number, subject: string, body: string) => { const e = ownerEmail(rid); if (e) sendMail(e, subject, body); };

function appCtx(fd: FormData) {
  const a = db.prepare("SELECT * FROM applications WHERE id=?").get(n(fd, "app_id")) as { id: number; restaurant_id: number; state: string } | undefined;
  if (!a) go("/super", "Application not found.", true);
  return { a, back: `/super/apps/${a.id}` };
}

export async function assignFee(fd: FormData) {
  const u = await requireSuper(); const { a, back } = appCtx(fd);
  const amt = Math.round(Number(s(fd, "amount")) * 100);
  if (!(amt > 0)) go(back, "Enter a fee amount above zero.", true);
  const f = fee(a.restaurant_id)!;
  if (f.state === "confirmed") go(back, "The fee is already confirmed and locked.", true); // FEE-03
  db.prepare("UPDATE setup_fees SET prev_amount_paise=amount_paise, amount_paise=?, state='awaiting' WHERE restaurant_id=?").run(amt, a.restaurant_id);
  log(u.id, "fee_assigned", `r${a.restaurant_id} ${amt}`);
  notify(a.restaurant_id, "Your setup fee", `Your one-time setup fee is ₹${(amt / 100).toFixed(2)}. See your dashboard for details.`);
  go(back, "Fee saved and owner notified.");
}
export async function confirmFee(fd: FormData) {
  const u = await requireSuper(); const { a, back } = appCtx(fd);
  const f = fee(a.restaurant_id)!;
  if (f.state !== "awaiting") go(back, "Assign a fee first.", true);
  db.prepare("UPDATE setup_fees SET state='confirmed', confirmed_at=datetime('now') WHERE restaurant_id=? AND state='awaiting'").run(a.restaurant_id);
  log(u.id, "fee_confirmed", `r${a.restaurant_id}`);
  notify(a.restaurant_id, "Setup fee confirmed", "We have received your setup fee. Thank you.");
  maybeActivate(a.restaurant_id); announceIfActive(a.restaurant_id);
  go(back, "Fee confirmed.");
}
function announceIfActive(rid: number) { if (getRestaurant(rid)?.state === "active") notify(rid, "Your restaurant is live", "Your restaurant is now visible and can take orders."); }

export async function decideApplication(fd: FormData) {
  const u = await requireSuper(); const { a, back } = appCtx(fd); const d = s(fd, "decision"), reason = s(fd, "reason");
  if (a.state !== "submitted") go(back, "This application is not waiting for review.", true);
  if ((d === "reject" || d === "return") && !reason) go(back, "A reason is required.", true);
  const state = d === "approve" ? "approved" : d === "reject" ? "rejected" : "returned";
  if (!["approve", "reject", "return"].includes(d)) go(back);
  db.prepare("UPDATE applications SET state=?, reason=?, updated_at=datetime('now') WHERE id=? AND state='submitted'").run(state, d === "approve" ? null : reason, a.id);
  log(u.id, `application_${state}`, `${a.id}`);
  const msg = { approved: "Your application was approved. Complete your setup checklist in your dashboard.", rejected: `Your application was not approved. Reason: ${reason}`, returned: `Your application needs corrections. Reason: ${reason}` }[state]!;
  notify(a.restaurant_id, `Application ${state}`, msg);
  if (state === "approved") { maybeActivate(a.restaurant_id); announceIfActive(a.restaurant_id); }
  go("/super", `Application ${state}.`);
}

export async function activateRestaurant(fd: FormData) {
  const u = await requireSuper(); const id = n(fd, "id"); const r = getRestaurant(id);
  if (!r) go("/super/restaurants", "Not found.", true);
  if (!checklist(r).ok) go("/super/restaurants", "Activation conditions are not all met yet.", true); // server-enforced (5.4)
  db.prepare("UPDATE restaurants SET state='active', inactive_reason=NULL WHERE id=?").run(id);
  log(u.id, "restaurant_activated", String(id)); announceIfActive(id);
  go("/super/restaurants", "Restaurant is active.");
}
export async function deactivateRestaurant(fd: FormData) {
  const u = await requireSuper(); const id = n(fd, "id"), reason = s(fd, "reason");
  if (!reason) go("/super/restaurants", "A reason is required to deactivate.", true);
  db.prepare("UPDATE restaurants SET state='inactive', inactive_reason=? WHERE id=? AND state!='inactive'").run(reason, id);
  log(u.id, "restaurant_deactivated", `${id}: ${reason}`);
  notify(id, "Your restaurant was deactivated", `Reason: ${reason}`);
  go("/super/restaurants", "Restaurant deactivated. Unpaid orders stay outstanding until reactivation.");
}

export async function createAdmin(fd: FormData) {
  const u = await requireSuper(); const rid = n(fd, "restaurant_id"), email = s(fd, "email").toLowerCase(), name = s(fd, "name");
  if (!getRestaurant(rid) || !/^\S+@\S+\.\S+$/.test(email) || !name) go("/super/admins", "Restaurant, name and a valid email are required.", true);
  if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) go("/super/admins", "That email already has an account.", true);
  const r = db.prepare("INSERT INTO users(email,name,role,restaurant_id,email_verified) VALUES(?,?,'restaurant_admin',?,1)").run(email, name, rid);
  sendMail(email, "Your admin account", `Set your password: ${baseUrl()}/reset?token=${newToken(Number(r.lastInsertRowid), "reset", 48)}`);
  log(u.id, "admin_created", `${email} r${rid}`);
  go("/super/admins", "Admin created. A link to set the password was emailed.");
}
export async function toggleAdmin(fd: FormData) {
  const u = await requireSuper(); const id = n(fd, "id");
  const a = db.prepare("SELECT * FROM users WHERE id=? AND role='restaurant_admin'").get(id) as { disabled: number; restaurant_id: number } | undefined;
  if (!a) go("/super/admins", "Not found.", true);
  db.prepare("UPDATE users SET disabled=?, session_version=session_version+1 WHERE id=?").run(a.disabled ? 0 : 1, id);
  log(u.id, a.disabled ? "admin_enabled" : "admin_disabled", String(id));
  const left = (db.prepare("SELECT COUNT(*) c FROM users WHERE restaurant_id=? AND role='restaurant_admin' AND disabled=0").get(a.restaurant_id) as { c: number }).c;
  go("/super/admins", !a.disabled && left === 0 ? "Disabled. Warning: this restaurant now has no active admin and cannot process orders." : "Updated.");
}
export async function recoverAdmin(fd: FormData) {
  const u = await requireSuper(); const id = n(fd, "id");
  const a = db.prepare("SELECT email FROM users WHERE id=? AND role='restaurant_admin'").get(id) as { email: string } | undefined;
  if (!a) go("/super/admins", "Not found.", true);
  sendMail(a.email, "Reset your password", `Reset link: ${baseUrl()}/reset?token=${newToken(id, "reset", 2)}`);
  log(u.id, "admin_recovery_sent", String(id));
  go("/super/admins", "Recovery link sent.");
}

export async function supportRevertPayment(fd: FormData) {
  const u = await requireSuper(); const id = n(fd, "id"), note = s(fd, "note");
  if (!note) go("/super/orders", "A note is required.", true);
  const r = db.prepare("UPDATE orders SET payment_status='pending', paid_by=NULL, paid_at=NULL, claimed_paid=0 WHERE id=? AND payment_status='paid'").run(id);
  if (r.changes) log(u.id, "support_correction_payment_reverted", `${id}: ${note}`);
  go("/super/orders", r.changes ? "Payment reverted to Pending." : "Nothing to revert.", !r.changes);
}
export async function saveSettings(fd: FormData) {
  const u = await requireSuper(); const v = Math.floor(n(fd, "max_pending"));
  if (!(v >= 1 && v <= 50)) go("/super", "Enter 1–50.", true);
  db.prepare("INSERT INTO settings VALUES('max_pending_per_restaurant',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(v));
  log(u.id, "settings_saved"); go("/super", "Saved.");
}
