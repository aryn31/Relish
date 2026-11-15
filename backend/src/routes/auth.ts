import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, log, rateOk } from "../db";
import { ok, fail, clientIp, str } from "../http";
import { currentUser, requireUser, publicUser, issueSession, clearSession, newToken, useToken, strongPassword, type User } from "../auth";
import { sendMail, baseUrl } from "../mail";

// Owns: /api/me*, /api/auth/*
export const router = Router();

const USER_COLS = "id,email,name,role,restaurant_id,email_verified,disabled,lang,session_version";

/** The signed-in user, or null. */
router.get("/me", async (req, res) => ok(res, { user: publicUser(await currentUser(req)) }));

/** Remember the user's language on their account. */
router.patch("/me/lang", async (req, res) => {
  const u = await requireUser(req);
  const lang = req.body?.lang === "hi" ? "hi" : "en";
  await db.prepare("UPDATE users SET lang=? WHERE id=?").run(lang, u.id);
  ok(res);
});

/** Update profile (name). Body: { name } */
router.patch("/me", async (req, res) => {
  const u = await requireUser(req);
  const name = str(req.body?.name);
  if (name) await db.prepare("UPDATE users SET name=? WHERE id=?").run(name, u.id);
  ok(res, { message: "Saved." });
});

/** AUTH-09: customer deletes their account (anonymized; order records are kept). */
router.delete("/me", async (req, res) => {
  const u = await currentUser(req);
  if (!u || u.role !== "customer") fail("Not allowed.", 403, "/");
  await db.prepare("UPDATE users SET name='Deleted customer', email=?, password_hash=NULL, google_id=NULL, disabled=1 WHERE id=?").run(`deleted-${u!.id}@invalid.local`, u!.id);
  await log(u!.id, "account_deleted");
  clearSession(res);
  ok(res, { message: "Your account has been deleted." });
});

/** Body: { email, password }. Returns { token, maxAge, user, role }. */
router.post("/auth/login", async (req, res) => {
  const email = str(req.body?.email).toLowerCase(), pw = String(req.body?.password ?? "");
  if (!await rateOk(`login:${clientIp(req)}`, 20, 600) || !await rateOk(`login:${email}`, 8, 600)) fail("Too many attempts. Please wait a few minutes.", 429, "/login");
  const u = await db.prepare("SELECT * FROM users WHERE email=?").get(email) as (User & { password_hash: string | null }) | undefined;
  const good = u && u.password_hash && !u.disabled && (await bcrypt.compare(pw, u.password_hash));
  if (!good) fail("Email or password is incorrect.", 401);
  const s = await issueSession(res, u!);
  ok(res, { ...s, role: u!.role, user: publicUser(u!) });
});

/** Customer sign-up. Body: { email, name, password }. Returns { token, maxAge, user, role }. */
router.post("/auth/register", async (req, res) => {
  const email = str(req.body?.email).toLowerCase(), name = str(req.body?.name), pw = String(req.body?.password ?? "");
  if (!await rateOk(`reg:${clientIp(req)}`, 10, 600)) fail("Too many attempts. Please wait a few minutes.", 429);
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("Please enter a valid email address.");
  if (!name) fail("Please enter your name.");
  if (!strongPassword(pw)) fail("Password must be at least 8 characters and include a letter and a number.");
  const exists = await db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (exists) fail("We could not create this account. Try signing in or resetting your password."); // no enumeration detail
  const r = await db.prepare("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'customer')").run(email, name, bcrypt.hashSync(pw, 10));
  const u = (await db.prepare(`SELECT ${USER_COLS} FROM users WHERE id=?`).get(Number(r.lastInsertRowid))) as User;
  const s = await issueSession(res, u);
  ok(res, { ...s, role: u.role, user: publicUser(u) });
});

/** Body: { email }. Always the same answer (no enumeration). */
router.post("/auth/forgot", async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  if (await rateOk(`forgot:${clientIp(req)}`, 5, 600)) {
    const u = await db.prepare("SELECT id FROM users WHERE email=? AND password_hash IS NOT NULL AND disabled=0").get(email) as { id: number } | undefined;
    if (u) await sendMail(email, "Reset your password", `Reset link (valid 2 hours): ${baseUrl()}/reset?token=${await newToken(u.id, "reset", 2)}`);
  }
  ok(res, { message: "If that email has an account, a reset link has been sent." });
});

/** Body: { token, password }. Bumps session_version (signs out everywhere). */
router.post("/auth/reset", async (req, res) => {
  const token = String(req.body?.token ?? ""), pw = String(req.body?.password ?? "");
  if (!strongPassword(pw)) fail("Password must be at least 8 characters and include a letter and a number.", 400, `/reset?token=${token}`);
  const uid = await useToken(token, "reset");
  if (!uid) fail("This reset link is invalid or expired.", 400, "/forgot");
  await db.prepare("UPDATE users SET password_hash=?, session_version=session_version+1 WHERE id=?").run(bcrypt.hashSync(pw, 10), uid);
  ok(res, { message: "Password updated. Please sign in.", redirect: "/login" });
});

/** Owner email verification link. Body: { token }. Returns { verified }. */
router.post("/auth/verify", async (req, res) => {
  const token = str(req.body?.token);
  const uid = token ? await useToken(token, "verify") : null;
  if (uid) await db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(uid);
  ok(res, { verified: !!uid });
});

router.post("/auth/logout", (_req, res) => { clearSession(res); ok(res); });
