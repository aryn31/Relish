import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, log, rateOk } from "../db";
import { ok, fail, clientIp, str } from "../http";
import { requireRestAdmin, issueSession, newToken, strongPassword, emailVerificationEnabled, publicUser, type User } from "../auth";
import { sendMail, baseUrl } from "../mail";
import { slugify, normPhone, application, getRestaurant, maybeActivate } from "../restaurant";

// Owns: /api/owner/*
export const router = Router();

/** Restaurant owner sign-up. Body: { email, password, name, owner, address, phone, type, fssai?, gstin? }.
 *  Creates the admin user, restaurant and a submitted application. Returns { token, maxAge, user, role, message }. */
router.post("/owner/register", async (req, res) => {
  const b = req.body ?? {};
  if (!await rateOk(`reg:${clientIp(req)}`, 10, 600)) fail("Too many attempts. Please wait a few minutes.", 429);
  const email = str(b.email).toLowerCase(), pw = str(b.password);
  const d = { name: str(b.name), owner: str(b.owner), address: str(b.address), phone: str(b.phone), type: str(b.type) };
  if (!d.name || !d.owner || !d.address || !d.type) fail("Please fill in all required fields.");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("Please enter a valid email address.");
  if (normPhone(d.phone).length !== 10) fail("Please enter a valid 10-digit contact number.");
  if (!strongPassword(pw)) fail("Password must be at least 8 characters and include a letter and a number.");
  if (await db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) fail("We could not create this account. Try signing in instead.");

  const tx = db.transaction(async () => {
    const u = await db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'restaurant_admin')").run(email, d.owner, bcrypt.hashSync(pw, 10));
    const r = await db.prepare("INSERT INTO restaurants(slug,name,owner_name,email,address,phone,phone_norm,type,fssai,gstin) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(await slugify(d.name), d.name, d.owner, email, d.address, d.phone, normPhone(d.phone), d.type, str(b.fssai) || null, str(b.gstin) || null);
    await db.prepare("UPDATE users SET restaurant_id=? WHERE id=?").run(r.lastInsertRowid, u.lastInsertRowid);
    await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state) VALUES(?,?,'submitted')").run(r.lastInsertRowid, u.lastInsertRowid);
    await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(r.lastInsertRowid);
    await db.prepare("INSERT INTO setup_fees(restaurant_id) VALUES(?)").run(r.lastInsertRowid);
    return { id: Number(u.lastInsertRowid) };
  });
  const { id } = await tx();
  if (emailVerificationEnabled()) await sendMail(email, "Verify your email", `Verify your email: ${baseUrl()}/verify?token=${await newToken(id, "verify")}`);
  // The request goes straight to the super admin (no separate submit step).
  await sendMail(email, "Application submitted", `We received your application for ${d.name}. We will review it shortly.`);
  const sa = (await db.prepare("SELECT email FROM users WHERE role='super_admin'").get()) as { email: string };
  await sendMail(sa.email, "New application", `${d.name} submitted an application.`);
  const u = (await db.prepare("SELECT id,email,name,role,restaurant_id,email_verified,disabled,lang,session_version FROM users WHERE id=?").get(id)) as User;
  const s = await issueSession(res, u);
  ok(res, { ...s, role: u.role, user: publicUser(u), message: "Account created. Your request has been sent to the platform team.", redirect: "/admin" });
});

/** Resend the owner's email verification link (only when verification is enabled). */
router.post("/owner/resend-verification", async (req, res) => {
  const u = await requireRestAdmin(req);
  if (!emailVerificationEnabled()) return ok(res);
  if (await rateOk(`resend:${u.id}`, 3, 600)) await sendMail(u.email, "Verify your email", `Verify your email: ${baseUrl()}/verify?token=${await newToken(u.id, "verify")}`);
  ok(res, { message: "Verification email sent." });
});

/** Submit a draft/returned application. Double-click safe (no-op otherwise). */
router.post("/owner/submit", async (req, res) => {
  const u = await requireRestAdmin(req);
  const app = await application(u.restaurant_id);
  if (!app || !["draft", "returned"].includes(app.state)) return ok(res);
  await db.prepare("UPDATE applications SET state='submitted', updated_at=datetime('now') WHERE id=? AND state IN ('draft','returned')").run(app.id);
  await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(u.restaurant_id);
  const r = (await getRestaurant(u.restaurant_id))!;
  await sendMail(u.email, "Application submitted", `We received your application for ${r.name}. We will review it shortly.`);
  const sa = await db.prepare("SELECT email FROM users WHERE role='super_admin'").get() as { email: string };
  await sendMail(sa.email, "New application", `${r.name} submitted an application.`);
  await log(u.id, "application_submitted", String(app.id));
  ok(res, { message: "Application submitted." });
});

/** After a rejection, start a new draft application. */
router.post("/owner/new-application", async (req, res) => {
  const u = await requireRestAdmin(req);
  const app = await application(u.restaurant_id);
  if (app?.state !== "rejected") return ok(res);
  await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state) VALUES(?,?,'draft')").run(u.restaurant_id, u.id);
  ok(res, { message: "Update your details, then submit a new application.", redirect: "/admin/info" });
});

/** Owner confirms their details are reviewed; may auto-activate. */
router.post("/owner/reviewed", async (req, res) => {
  const u = await requireRestAdmin(req);
  await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(u.restaurant_id);
  await maybeActivate(u.restaurant_id);
  ok(res);
});
