"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db, log, rateOk } from "@/lib/db";
import { startSession, requireRestAdmin, newToken, strongPassword, emailVerificationEnabled } from "@/lib/auth";
import { sendMail, baseUrl } from "@/lib/mail";
import { go } from "@/lib/flash";
import { slugify, normPhone, application, getRestaurant, maybeActivate } from "@/lib/restaurant";

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();

export async function registerRestaurant(fd: FormData) {
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  const back = "/owner/register";
  if (!await rateOk(`reg:${ip}`, 10, 600)) go(back, "Too many attempts. Please wait a few minutes.", true);
  const email = s(fd, "email").toLowerCase(), pw = s(fd, "password");
  const d = { name: s(fd, "name"), owner: s(fd, "owner"), address: s(fd, "address"), phone: s(fd, "phone"), type: s(fd, "type") };
  if (!d.name || !d.owner || !d.address || !d.type) go(back, "Please fill in all required fields.", true);
  if (!/^\S+@\S+\.\S+$/.test(email)) go(back, "Please enter a valid email address.", true);
  if (normPhone(d.phone).length !== 10) go(back, "Please enter a valid 10-digit contact number.", true);
  if (!strongPassword(pw)) go(back, "Password must be at least 8 characters and include a letter and a number.", true);
  if (await db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) go(back, "We could not create this account. Try signing in instead.", true);

  const tx = db.transaction(async () => {
    const u = await db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'restaurant_admin')").run(email, d.owner, bcrypt.hashSync(pw, 10));
    const r = await db.prepare("INSERT INTO restaurants(slug,name,owner_name,email,address,phone,phone_norm,type,fssai,gstin) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(await slugify(d.name), d.name, d.owner, email, d.address, d.phone, normPhone(d.phone), d.type, s(fd, "fssai") || null, s(fd, "gstin") || null);
    await db.prepare("UPDATE users SET restaurant_id=? WHERE id=?").run(r.lastInsertRowid, u.lastInsertRowid);
    await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state) VALUES(?,?,'submitted')").run(r.lastInsertRowid, u.lastInsertRowid);
    await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(r.lastInsertRowid);
    await db.prepare("INSERT INTO setup_fees(restaurant_id) VALUES(?)").run(r.lastInsertRowid);
    return { id: Number(u.lastInsertRowid) };
  });
  const u = await tx();
  if (emailVerificationEnabled()) await sendMail(email, "Verify your email", `Verify your email: ${baseUrl()}/verify?token=${await newToken(u.id, "verify")}`);
  // The request goes straight to the super admin (no separate submit step).
  await sendMail(email, "Application submitted", `We received your application for ${d.name}. We will review it shortly.`);
  const sa = (await db.prepare("SELECT email FROM users WHERE role='super_admin'").get()) as { email: string };
  await sendMail(sa.email, "New application", `${d.name} submitted an application.`);
  await startSession({ id: u.id, session_version: 0 });
  go("/admin", "Account created. Your request has been sent to the platform team.");
}

export async function resendVerification() {
  const u = await requireRestAdmin();
  if (!emailVerificationEnabled()) go("/admin");
  if (await rateOk(`resend:${u.id}`, 3, 600)) await sendMail(u.email, "Verify your email", `Verify your email: ${baseUrl()}/verify?token=${await newToken(u.id, "verify")}`);
  go("/admin", "Verification email sent.");
}

export async function submitApplication() {
  const u = await requireRestAdmin();
  const app = await application(u.restaurant_id);
  if (!app || !["draft", "returned"].includes(app.state)) go("/admin"); // double-click safe
  await db.prepare("UPDATE applications SET state='submitted', updated_at=datetime('now') WHERE id=? AND state IN ('draft','returned')").run(app.id);
  await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(u.restaurant_id);
  const r = (await getRestaurant(u.restaurant_id))!;
  await sendMail(u.email, "Application submitted", `We received your application for ${r.name}. We will review it shortly.`);
  const sa = await db.prepare("SELECT email FROM users WHERE role='super_admin'").get() as { email: string };
  await sendMail(sa.email, "New application", `${r.name} submitted an application.`);
  await log(u.id, "application_submitted", String(app.id));
  go("/admin", "Application submitted.");
}

export async function startNewApplication() {
  const u = await requireRestAdmin();
  const app = await application(u.restaurant_id);
  if (app?.state !== "rejected") go("/admin");
  await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state) VALUES(?,?,'draft')").run(u.restaurant_id, u.id);
  go("/admin/info", "Update your details, then submit a new application.");
}

export async function markReviewed() {
  const u = await requireRestAdmin();
  await db.prepare("UPDATE restaurants SET details_reviewed=1 WHERE id=?").run(u.restaurant_id);
  await maybeActivate(u.restaurant_id);
  go("/admin");
}
