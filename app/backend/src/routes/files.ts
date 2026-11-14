import { Router } from "express";
import QRCode from "qrcode";
import { db } from "../db";
import { readUpload } from "../files";
import { currentUser } from "../auth";
import { getRestaurant, getBySlug } from "../restaurant";
import { baseUrl } from "../mail";

/** Image and QR endpoints (served to browsers through the frontend's /api proxy). */
export const router = Router();

// Menu item images are public, but only if they belong to an item (UPI QR files are never served here).
router.get("/img/:file", async (req, res) => {
  const file = req.params.file;
  if (!(await db.prepare("SELECT 1 FROM items WHERE image=?").get(file))) { res.status(404).send("Not found"); return; }
  const f = await readUpload(file);
  if (!f) { res.status(404).send("Not found"); return; }
  res.set({ "content-type": f.type, "cache-control": "public, max-age=86400" }).send(f.buf);
});

// The restaurant's own admins can preview the UPI QR they uploaded. (Declared before /upi/:id.)
router.get("/upi/mine", async (req, res) => {
  const u = await currentUser(req);
  if (!u || u.role !== "restaurant_admin" || !u.restaurant_id) { res.status(403).send("Forbidden"); return; }
  const r = await getRestaurant(u.restaurant_id);
  const f = r?.upi_qr ? await readUpload(r.upi_qr) : null;
  if (!f) { res.status(404).send("Not found"); return; }
  res.set({ "content-type": f.type, "cache-control": "private, no-store" }).send(f.buf);
});

// PAY-08: UPI QR is only served to the order's customer, the restaurant's admins, or the super admin.
router.get("/upi/:id", async (req, res) => {
  const u = await currentUser(req);
  if (!u) { res.status(403).send("Forbidden"); return; }
  const o = (await db.prepare("SELECT o.customer_id, o.restaurant_id, r.upi_qr FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.public_id=?").get(req.params.id)) as { customer_id: number; restaurant_id: number; upi_qr: string | null } | undefined;
  if (!o || !o.upi_qr) { res.status(404).send("Not found"); return; }
  const allowed = u.id === o.customer_id || u.role === "super_admin" || (u.role === "restaurant_admin" && u.restaurant_id === o.restaurant_id);
  if (!allowed) { res.status(403).send("Forbidden"); return; }
  const f = await readUpload(o.upi_qr);
  if (!f) { res.status(404).send("Not found"); return; }
  res.set({ "content-type": f.type, "cache-control": "private, no-store" }).send(f.buf);
});

// QR-01/02: stable URL /r/{slug}. Only that restaurant's admins (or super admin) may download.
router.get("/qr/:slug", async (req, res) => {
  const u = await currentUser(req); const r = await getBySlug(req.params.slug);
  if (!u || !r || !(u.role === "super_admin" || (u.role === "restaurant_admin" && u.restaurant_id === r.id))) { res.status(403).send("Forbidden"); return; }
  const png = await QRCode.toBuffer(`${baseUrl()}/r/${r.slug}`, { width: 800, margin: 2 });
  res.set({ "content-type": "image/png", "content-disposition": `attachment; filename="${r.slug}-menu-qr.png"` }).send(png);
});
