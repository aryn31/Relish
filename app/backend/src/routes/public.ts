import { Router } from "express";
import { db } from "../db";
import { ok, fail, str } from "../http";
import { getBySlug, type Restaurant } from "../restaurant";
import { menuFor, coverFor, publicRestaurant } from "../menu";

// Owns: /api/public/*, /api/restaurants*
export const router = Router();

const PAGE = 12;

/** Home page data. Query: q, type, p. `list` holds up to PAGE+1 rows (the extra one means "there is a next page"). */
router.get("/public/home", async (req, res) => {
  const q = str(req.query.q), type = str(req.query.type);
  const page = Math.max(1, Number(req.query.p) || 1);
  const where = ["r.state='active'"]; const args: (string | number)[] = [];
  if (q) { where.push("r.name ILIKE ?"); args.push(`%${q}%`); }
  if (type) { where.push("r.type=?"); args.push(type); }
  const rows = (await db.prepare(`SELECT r.*, (SELECT image FROM items WHERE restaurant_id=r.id AND deleted=0 AND image IS NOT NULL ORDER BY id LIMIT 1) cover FROM restaurants r WHERE ${where.join(" AND ")} ORDER BY r.name LIMIT ? OFFSET ?`).all(...args, PAGE + 1, (page - 1) * PAGE)) as (Restaurant & { cover: string | null })[];
  const types = ((await db.prepare("SELECT DISTINCT type FROM restaurants WHERE state='active' ORDER BY type").all()) as { type: string }[]).map((x) => x.type);
  const collage = ((await db.prepare("SELECT DISTINCT ON (i.restaurant_id) i.image FROM items i JOIN restaurants r ON r.id=i.restaurant_id WHERE r.state='active' AND i.image IS NOT NULL AND i.deleted=0 ORDER BY i.restaurant_id, i.id DESC LIMIT 3").all()) as { image: string }[]).map((x) => x.image);
  const stats = (await db.prepare("SELECT (SELECT COUNT(*) FROM restaurants WHERE state='active') r, (SELECT COUNT(*) FROM items i JOIN restaurants r ON r.id=i.restaurant_id WHERE r.state='active' AND i.deleted=0) d, (SELECT COUNT(*) FROM orders) o").get()) as { r: number; d: number; o: number };
  ok(res, { list: rows.map((r) => ({ ...publicRestaurant(r), cover: r.cover })), types, collage, stats, page, pageSize: PAGE });
});

/** Photo credits for demo images. */
router.get("/public/credits", async (_req, res) => {
  const r = (await db.prepare("SELECT value FROM settings WHERE key='photo_credits'").get()) as { value: string } | undefined;
  let credits: unknown[] = [];
  try { credits = r ? JSON.parse(r.value) : []; } catch { credits = []; }
  ok(res, { credits });
});

/** A recent menu photo for the sign-in / register pages. */
router.get("/public/auth-photo", async (_req, res) => {
  const pic = ((await db.prepare("SELECT image FROM items WHERE image IS NOT NULL AND deleted=0 ORDER BY id DESC LIMIT 1").get()) as { image: string } | undefined)?.image ?? null;
  ok(res, { image: pic });
});

/** Public restaurant page. PUB-01/06: the menu is only exposed while the restaurant is Active.
 *  Returns { restaurant, open, menu, cover } (menu/cover null when not open). Unknown slug → 404. */
router.get("/restaurants/:slug", async (req, res) => {
  const r = await getBySlug(String(req.params.slug));
  if (!r) fail("Not found.", 404);
  const open = r!.state === "active";
  ok(res, { restaurant: publicRestaurant(r!), open, menu: open ? await menuFor(r!.id) : null, cover: open ? await coverFor(r!.id) : null });
});
