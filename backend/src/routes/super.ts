import { Router, type Request } from "express";
import { db, log, setting } from "../db";
import { requireSuper, newToken, emailVerificationEnabled } from "../auth";
import { sendMail, baseUrl } from "../mail";
import { fail, ok, str, num } from "../http";
import { getRestaurant, fee, checklist, maybeActivate, feeEnabled, type Restaurant } from "../restaurant";
import { menuFor, coverFor } from "../menu";

/** Super-admin dashboard API: everything under /api/super/*. Every route requires a super admin. */
export const router = Router();

/** Positive integer from a path/query/body value, or 0 (matches nothing) when it is not one. */
const int = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };

const ownerEmail = async (rid: number) => (await db.prepare("SELECT email FROM users WHERE restaurant_id=? AND role='restaurant_admin' ORDER BY id LIMIT 1").get(rid) as { email: string } | undefined)?.email;
const notify = async (rid: number, subject: string, body: string) => { const e = await ownerEmail(rid); if (e) await sendMail(e, subject, body); };
async function announceIfActive(rid: number) { if ((await getRestaurant(rid))?.state === "active") await notify(rid, "Your restaurant is live", "Your restaurant is now visible and can take orders."); }

/** Application referenced by :id. Missing → error that sends the super admin back to the dashboard. */
async function appCtx(req: Request) {
  const appId = int(req.params.id);
  const a = appId ? (await db.prepare("SELECT * FROM applications WHERE id=?").get(appId)) as { id: number; restaurant_id: number; state: string } | undefined : undefined;
  if (!a) return fail("Application not found.", 404, "/super");
  return a;
}

/* ---------- Dashboard ---------- */

router.get("/super/overview", async (req, res) => {
  await requireSuper(req);
  const c = async (q: string) => ((await db.prepare(q).get()) as { c: number }).c;
  const stats: [string, number][] = await Promise.all(([
    ["Total restaurants", "SELECT COUNT(*) c FROM restaurants"], ["Active", "SELECT COUNT(*) c FROM restaurants WHERE state='active'"], ["Inactive", "SELECT COUNT(*) c FROM restaurants WHERE state='inactive'"],
    ["Applications awaiting review", "SELECT COUNT(*) c FROM applications WHERE state='submitted'"], ...(feeEnabled() ? [["Setup fees awaiting confirmation", "SELECT COUNT(*) c FROM setup_fees WHERE state='awaiting'"]] : []),
    ["Registered customers", "SELECT COUNT(*) c FROM users WHERE role='customer' AND disabled=0"]] as [string, string][]).map(async ([k, q]) => [k, await c(q)] as [string, number]));
  const attention = await db.prepare(`SELECT a.id,a.state,a.updated_at,r.name,f.state fs,f.amount_paise FROM applications a JOIN restaurants r ON r.id=a.restaurant_id JOIN setup_fees f ON f.restaurant_id=r.id WHERE a.state='submitted' ${feeEnabled() ? "OR (a.state='approved' AND f.state='awaiting')" : ""} ORDER BY a.updated_at`).all();
  ok(res, { stats, attention, maxPending: await setting("max_pending_per_restaurant", 5) });
});

router.post("/super/settings", async (req, res) => {
  const u = await requireSuper(req); const v = Math.floor(num(req.body?.max_pending));
  if (!(v >= 1 && v <= 50)) fail("Enter 1–50.");
  await db.prepare("INSERT INTO settings VALUES('max_pending_per_restaurant',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(v));
  await log(u.id, "settings_saved");
  ok(res, { message: "Saved." });
});

/* ---------- Applications ---------- */

router.get("/super/applications", async (req, res) => {
  await requireSuper(req);
  const s = str(req.query.s) || "pending";
  const states = s === "approved" ? ["approved"] : s === "rejected" ? ["rejected"] : ["submitted", "returned"];
  const rows = await db.prepare(`SELECT a.id,a.state,a.updated_at,r.name,r.type,r.address,f.amount_paise,f.state fs FROM applications a JOIN restaurants r ON r.id=a.restaurant_id JOIN setup_fees f ON f.restaurant_id=r.id WHERE a.state = ANY(string_to_array(?, ',')) ORDER BY a.updated_at DESC`).all(states.join(","));
  const counts = (await db.prepare("SELECT COUNT(*) FILTER (WHERE state IN ('submitted','returned')) p, COUNT(*) FILTER (WHERE state='approved') a, COUNT(*) FILTER (WHERE state='rejected') r FROM applications").get()) as { p: number; a: number; r: number };
  ok(res, { rows, counts });
});

router.get("/super/applications/:id", async (req, res) => {
  await requireSuper(req);
  const appId = int(req.params.id);
  const a = appId ? await db.prepare("SELECT * FROM applications WHERE id=?").get(appId) as { id: number; restaurant_id: number; state: string; reason: string | null; updated_at: string } | undefined : undefined;
  if (!a) return fail("Not found.", 404);
  const r = (await getRestaurant(a.restaurant_id))! as Restaurant & { phone_norm?: string };
  const f = (await fee(r.id)) ?? null;
  const dups = await db.prepare("SELECT id,name,state FROM restaurants WHERE id!=? AND (phone_norm=? OR (lower(name)=lower(?) AND lower(address)=lower(?)))").all(r.id, r.phone_norm ?? "", r.name, r.address);
  const owner = (await db.prepare("SELECT name,email,email_verified FROM users WHERE restaurant_id=? AND role='restaurant_admin' ORDER BY id LIMIT 1").get(r.id)) ?? null;
  const preview = str(req.query.preview) ? { menu: await menuFor(r.id), cover: await coverFor(r.id) } : null;
  const { phone_norm: _pn, ...restaurant } = r;
  ok(res, { application: a, restaurant, fee: f, owner, dups, feeEnabled: feeEnabled(), emailVerificationEnabled: emailVerificationEnabled(), preview });
});

router.post("/super/applications/:id/fee", async (req, res) => {
  const u = await requireSuper(req); const a = await appCtx(req);
  if (!feeEnabled()) fail("Setup fees are switched off.");
  const amt = Math.round(Number(str(req.body?.amount)) * 100);
  if (!(amt > 0)) fail("Enter a fee amount above zero.");
  const f = (await fee(a.restaurant_id))!;
  if (f.state === "confirmed") fail("The fee is already confirmed and locked."); // FEE-03
  await db.prepare("UPDATE setup_fees SET prev_amount_paise=amount_paise, amount_paise=?, state='awaiting' WHERE restaurant_id=?").run(amt, a.restaurant_id);
  await log(u.id, "fee_assigned", `r${a.restaurant_id} ${amt}`);
  await notify(a.restaurant_id, "Your setup fee", `Your one-time setup fee is ₹${(amt / 100).toFixed(2)}. See your dashboard for details.`);
  ok(res, { message: "Fee saved and owner notified." });
});

router.post("/super/applications/:id/fee/confirm", async (req, res) => {
  const u = await requireSuper(req); const a = await appCtx(req);
  if (!feeEnabled()) fail("Setup fees are switched off.");
  const f = (await fee(a.restaurant_id))!;
  if (f.state !== "awaiting") fail("Assign a fee first.");
  await db.prepare("UPDATE setup_fees SET state='confirmed', confirmed_at=datetime('now') WHERE restaurant_id=? AND state='awaiting'").run(a.restaurant_id);
  await log(u.id, "fee_confirmed", `r${a.restaurant_id}`);
  await notify(a.restaurant_id, "Setup fee confirmed", "We have received your setup fee. Thank you.");
  await maybeActivate(a.restaurant_id); await announceIfActive(a.restaurant_id);
  ok(res, { message: "Fee confirmed." });
});

/** body: { decision: "approve"|"reject"|"return", reason }. Success sends the super admin to the dashboard (`redirect: "/super"`). */
router.post("/super/applications/:id/decision", async (req, res) => {
  const u = await requireSuper(req); const a = await appCtx(req); const d = str(req.body?.decision), reason = str(req.body?.reason);
  if (a.state !== "submitted") fail("This application is not waiting for review.");
  if ((d === "reject" || d === "return") && !reason) fail("A reason is required.");
  const state = d === "approve" ? "approved" : d === "reject" ? "rejected" : "returned";
  if (!["approve", "reject", "return"].includes(d)) { ok(res); return; } // unknown decision: nothing happens, back to the application
  await db.prepare("UPDATE applications SET state=?, reason=?, updated_at=datetime('now') WHERE id=? AND state='submitted'").run(state, d === "approve" ? null : reason, a.id);
  await log(u.id, `application_${state}`, `${a.id}`);
  const msg = { approved: "Your application was approved. Complete your setup checklist in your dashboard.", rejected: `Your application was not approved. Reason: ${reason}`, returned: `Your application needs corrections. Reason: ${reason}` }[state]!;
  await notify(a.restaurant_id, `Application ${state}`, msg);
  if (state === "approved") { await maybeActivate(a.restaurant_id); await announceIfActive(a.restaurant_id); }
  ok(res, { message: `Application ${state}.`, redirect: "/super" });
});

/* ---------- Restaurants ---------- */

router.get("/super/restaurants", async (req, res) => {
  await requireSuper(req);
  const rs = await db.prepare("SELECT * FROM restaurants ORDER BY id DESC").all() as (Restaurant & { phone_norm?: string })[];
  const restaurants = [];
  for (const { phone_norm: _pn, ...r } of rs) restaurants.push({ ...r, checklist: await checklist(r as Restaurant), fee: (await fee(r.id)) ?? null });
  ok(res, { restaurants, feeEnabled: feeEnabled() });
});

router.post("/super/restaurants/:id/activate", async (req, res) => {
  const u = await requireSuper(req); const rid = int(req.params.id); const r = rid ? await getRestaurant(rid) : undefined;
  if (!r) return fail("Not found.", 404);
  if (!(await checklist(r)).ok) fail("Activation conditions are not all met yet."); // server-enforced (5.4)
  await db.prepare("UPDATE restaurants SET state='active', inactive_reason=NULL WHERE id=?").run(rid);
  await log(u.id, "restaurant_activated", String(rid)); await announceIfActive(rid);
  ok(res, { message: "Restaurant is active." });
});

/** body: { reason } (required) */
router.post("/super/restaurants/:id/deactivate", async (req, res) => {
  const u = await requireSuper(req); const rid = int(req.params.id), reason = str(req.body?.reason);
  if (!reason) fail("A reason is required to deactivate.");
  await db.prepare("UPDATE restaurants SET state='inactive', inactive_reason=? WHERE id=? AND state!='inactive'").run(reason, rid);
  await log(u.id, "restaurant_deactivated", `${rid}: ${reason}`);
  await notify(rid, "Your restaurant was deactivated", `Reason: ${reason}`);
  ok(res, { message: "Restaurant deactivated. Unpaid orders stay outstanding until reactivation." });
});

/* ---------- Admin accounts ---------- */

router.get("/super/admins", async (req, res) => {
  await requireSuper(req);
  const restaurants = await db.prepare("SELECT id,name FROM restaurants ORDER BY name").all();
  const admins = await db.prepare("SELECT u.id,u.name,u.email,u.disabled,u.restaurant_id, r.name rname FROM users u JOIN restaurants r ON r.id=u.restaurant_id WHERE u.role='restaurant_admin' ORDER BY r.name,u.id").all();
  ok(res, { restaurants, admins });
});

/** body: { restaurant_id, email, name } */
router.post("/super/admins", async (req, res) => {
  const u = await requireSuper(req); const rid = int(req.body?.restaurant_id), email = str(req.body?.email).toLowerCase(), name = str(req.body?.name);
  if (!rid || !await getRestaurant(rid) || !/^\S+@\S+\.\S+$/.test(email) || !name) fail("Restaurant, name and a valid email are required.");
  if (await db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) fail("That email already has an account.");
  const r = await db.prepare("INSERT INTO users(email,name,role,restaurant_id,email_verified) VALUES(?,?,'restaurant_admin',?,1)").run(email, name, rid);
  await sendMail(email, "Your admin account", `Set your password: ${baseUrl()}/reset?token=${await newToken(Number(r.lastInsertRowid), "reset", 48)}`);
  await log(u.id, "admin_created", `${email} r${rid}`);
  ok(res, { message: "Admin created. A link to set the password was emailed." });
});

router.post("/super/admins/:id/toggle", async (req, res) => {
  const u = await requireSuper(req); const uid = int(req.params.id);
  const a = uid ? await db.prepare("SELECT * FROM users WHERE id=? AND role='restaurant_admin'").get(uid) as { disabled: number; restaurant_id: number } | undefined : undefined;
  if (!a) return fail("Not found.", 404);
  await db.prepare("UPDATE users SET disabled=?, session_version=session_version+1 WHERE id=?").run(a.disabled ? 0 : 1, uid);
  await log(u.id, a.disabled ? "admin_enabled" : "admin_disabled", String(uid));
  const left = (await db.prepare("SELECT COUNT(*) c FROM users WHERE restaurant_id=? AND role='restaurant_admin' AND disabled=0").get(a.restaurant_id) as { c: number }).c;
  ok(res, { message: !a.disabled && left === 0 ? "Disabled. Warning: this restaurant now has no active admin and cannot process orders." : "Updated." });
});

router.post("/super/admins/:id/recover", async (req, res) => {
  const u = await requireSuper(req); const uid = int(req.params.id);
  const a = uid ? await db.prepare("SELECT email FROM users WHERE id=? AND role='restaurant_admin'").get(uid) as { email: string } | undefined : undefined;
  if (!a) return fail("Not found.", 404);
  await sendMail(a.email, "Reset your password", `Reset link: ${baseUrl()}/reset?token=${await newToken(uid, "reset", 2)}`);
  await log(u.id, "admin_recovery_sent", String(uid));
  ok(res, { message: "Recovery link sent." });
});

/* ---------- Order lookup (SA-03: support and disputes only) ---------- */

router.get("/super/orders", async (req, res) => {
  await requireSuper(req);
  const restaurants = await db.prepare("SELECT id,name FROM restaurants ORDER BY name").all();
  const rid = int(req.query.r), n = Number(req.query.n);
  const order = rid && req.query.n && Number.isInteger(n) ? (await db.prepare("SELECT o.*, u.name cname FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.restaurant_id=? AND o.number=?").get(rid, n) as { id: number } | undefined) ?? null : null;
  const lines = order ? await db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(order.id) : [];
  ok(res, { restaurants, order, lines });
});

/** body: { note } (required) */
router.post("/super/orders/:id/revert-payment", async (req, res) => {
  const u = await requireSuper(req); const oid = int(req.params.id), note = str(req.body?.note);
  if (!note) fail("A note is required.");
  const r = await db.prepare("UPDATE orders SET payment_status='pending', paid_by=NULL, paid_at=NULL, claimed_paid=0 WHERE id=? AND payment_status='paid'").run(oid);
  if (!r.changes) fail("Nothing to revert.");
  await log(u.id, "support_correction_payment_reverted", `${oid}: ${note}`);
  ok(res, { message: "Payment reverted to Pending." });
});

/* ---------- Dev mail log ---------- */

router.get("/super/emails", async (req, res) => {
  await requireSuper(req);
  ok(res, { emails: await db.prepare("SELECT * FROM emails ORDER BY id DESC LIMIT 100").all() });
});
