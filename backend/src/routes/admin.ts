import { Router, type Request, type Response } from "express";
import { db, log } from "../db";
import { fail, ok, str, num, id } from "../http";
import { requireRestAdmin } from "../auth";
import { getRestaurant, application, fee, feeEnabled, checklist, maybeActivate, normPhone } from "../restaurant";
import { menuFor, coverFor, publicRestaurant } from "../menu";
import { saveUpload } from "../files";
import { upload } from "../upload";

// Owns: /api/admin/* (the restaurant admin dashboard). Every query is scoped to the admin's own restaurant.
export const router = Router();

/** Admin may edit setup data once approved (or while Returned/Draft for info). */
async function setupAdmin(req: Request) {
  const u = await requireRestAdmin(req);
  const app = await application(u.restaurant_id);
  return { u, rid: u.restaurant_id, approved: app?.state === "approved", app };
}
/** Menu, tables and UPI unlock only after the application is approved. */
async function menuAdmin(req: Request) {
  const c = await setupAdmin(req);
  if (!c.approved) fail("This unlocks after your application is approved.", 403, "/admin");
  return c;
}
/** Re-check activation after a setup change, then reply. */
const after = async (res: Response, rid: number, message: string) => { await maybeActivate(rid); ok(res, { message }); };
const own = async (rid: number) => (await getRestaurant(rid)) ?? fail("Not found.", 404);

// ---------- Overview (layout, home, onboarding) ----------
router.get("/admin/overview", async (req, res) => {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  const app = (await application(r.id)) ?? null, f = (await fee(r.id)) ?? null, cl = await checklist(r);
  let home = null;
  if (r.state !== "pending") {
    const c = async (q: string) => ((await db.prepare(q).get(r.id)) as { c: number }).c;
    const pend = await c("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND status='pending'");
    const cancels = await c("SELECT COUNT(*) c FROM cancel_requests cr JOIN orders o ON o.id=cr.order_id WHERE o.restaurant_id=? AND cr.status='requested'");
    const claims = await c("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND claimed_paid=1 AND payment_status='pending' AND status!='cancelled'");
    const owed = await c("SELECT COALESCE(SUM(total_paise),0) c FROM orders WHERE restaurant_id=? AND payment_status='pending' AND status!='cancelled'");
    const today = await db.prepare("SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='pending') pending, COUNT(*) FILTER (WHERE status='completed') completed, COUNT(*) FILTER (WHERE status='cancelled') cancelled FROM orders WHERE restaurant_id=? AND (created_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date").get(r.id);
    const recent = await db.prepare("SELECT id,number,table_name,total_paise,payment_method,status,created_at FROM orders WHERE restaurant_id=? ORDER BY id DESC LIMIT 6").all(r.id);
    const off = await db.prepare("SELECT name FROM items WHERE restaurant_id=? AND deleted=0 AND available=0").all(r.id);
    home = { pend, cancels, claims, owed, today, recent, off };
  }
  ok(res, { restaurant: r, application: app, fee: f, checklist: cl, feeEnabled: feeEnabled(), home });
});

// ---------- Restaurant info ----------
router.get("/admin/info", async (req, res) => {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  ok(res, { restaurant: r, application: (await application(r.id)) ?? null });
});
router.patch("/admin/info", async (req, res) => {
  const { u, rid, app } = await setupAdmin(req);
  const b = req.body ?? {};
  const name = str(b.name), phone = str(b.phone);
  if (!name || !str(b.address) || normPhone(phone).length !== 10) fail("Name, address and a valid 10-digit contact number are required.");
  await db.prepare("UPDATE restaurants SET name=?,description=?,address=?,phone=?,phone_norm=?,type=?,fssai=?,gstin=? WHERE id=?")
    .run(name, str(b.description), str(b.address), phone, normPhone(phone), str(b.type), str(b.fssai) || null, str(b.gstin) || null, rid);
  await log(u.id, "info_saved", `r${rid} app=${app?.state}`);
  ok(res, { message: "Saved." });
});

// ---------- Preview ----------
router.get("/admin/preview", async (req, res) => {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  ok(res, { restaurant: publicRestaurant(r), menu: await menuFor(r.id), cover: await coverFor(r.id) });
});

// ---------- Menu ----------
router.get("/admin/menu", async (req, res) => {
  const u = await requireRestAdmin(req); const rid = u.restaurant_id;
  const cats = await db.prepare("SELECT * FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid);
  const items = await db.prepare("SELECT * FROM items WHERE restaurant_id=? AND deleted=0 ORDER BY id").all(rid);
  const portions = await db.prepare("SELECT p.* FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=? ORDER BY p.id").all(rid);
  ok(res, { cats, items, portions });
});

router.post("/admin/categories", async (req, res) => {
  const { rid } = await menuAdmin(req); const name = str(req.body?.name);
  if (!name) fail("Please enter a category name.");
  const pos = ((await db.prepare("SELECT COALESCE(MAX(position),0)+1 p FROM categories WHERE restaurant_id=?").get(rid)) as { p: number }).p;
  await db.prepare("INSERT INTO categories(restaurant_id,name,position) VALUES(?,?,?)").run(rid, name, pos);
  await after(res, rid, "Category added.");
});
router.patch("/admin/categories/:id", async (req, res) => {
  const { rid } = await menuAdmin(req);
  await db.prepare("UPDATE categories SET name=? WHERE id=? AND restaurant_id=?").run(str(req.body?.name), id(req), rid);
  ok(res, { message: "Saved." });
});
router.post("/admin/categories/:id/move", async (req, res) => {
  const { rid } = await menuAdmin(req); const cid = id(req);
  const cats = (await db.prepare("SELECT id FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid)) as { id: number }[];
  const i = cats.findIndex((c) => c.id === cid), j = i + (str(req.body?.dir) === "up" ? -1 : 1);
  if (i >= 0 && j >= 0 && j < cats.length) { [cats[i], cats[j]] = [cats[j], cats[i]]; for (let k = 0; k < cats.length; k++) await db.prepare("UPDATE categories SET position=? WHERE id=?").run(k + 1, cats[k].id); }
  ok(res);
});
router.delete("/admin/categories/:id", async (req, res) => {
  const { rid } = await menuAdmin(req); const cid = id(req);
  if (await db.prepare("SELECT 1 FROM items WHERE category_id=? AND restaurant_id=? AND deleted=0").get(cid, rid)) fail("Move or remove the items in this category first.");
  await db.prepare("DELETE FROM categories WHERE id=? AND restaurant_id=?").run(cid, rid);
  ok(res, { message: "Category deleted." });
});

/** Create (id 0/absent) or update an item. Multipart: `data` = JSON of the item fields
 *  ({ id, name, category_id, description, veg, available, plabel[], pprice[], punavail[] }), optional file `image`. */
router.post("/admin/items", upload.single("image"), async (req, res) => {
  const { rid } = await menuAdmin(req);
  let d: Record<string, unknown> = {};
  try { d = typeof req.body?.data === "string" ? JSON.parse(req.body.data) : (req.body ?? {}); } catch { fail("Invalid request."); }
  const arr = (v: unknown) => (Array.isArray(v) ? v : v == null ? [] : [v]).map((x) => String(x ?? ""));
  const iid = num(d.id) || 0, name = str(d.name);
  const cat = num(d.category_id), veg = str(d.veg);
  const labels = arr(d.plabel), prices = arr(d.pprice);
  const portions: { label: string; paise: number }[] = [];
  for (let i = 0; i < prices.length; i++) {
    const label = labels[i] ?? "";
    if (!prices[i].trim() && !label.trim()) continue;
    const v = Number(prices[i]);
    if (!(v > 0) || v > 1_000_000) fail("Every portion needs a valid price above zero.");
    portions.push({ label: label.trim(), paise: Math.round(v * 100) });
  }
  if (!name || portions.length === 0) fail("Item name and at least one price are required.");
  if (portions.length > 1 && portions.some((p) => !p.label)) fail("When there are several portions, each needs a label.");
  if (!Number.isInteger(cat) || !(await db.prepare("SELECT 1 FROM categories WHERE id=? AND restaurant_id=?").get(cat, rid))) fail("Choose a category.");
  if (!Number.isInteger(iid) || iid < 0) fail("Item not found.");

  let image: string | undefined;
  const up = await saveUpload(req.file);
  if (up) { if ("error" in up) fail(up.error); else image = up.name; }

  const description = str(d.description);
  const vegV = veg === "1" ? 1 : veg === "0" ? 0 : null, avail = d.available ? 1 : 0;
  const unavail = new Set(arr(d.punavail));
  const tx = db.transaction(async () => {
    let itemId = iid;
    if (iid) {
      if (!(await db.prepare("SELECT 1 FROM items WHERE id=? AND restaurant_id=?").get(iid, rid))) throw new Error("nf");
      await db.prepare("UPDATE items SET name=?,description=?,category_id=?,veg=?,available=? WHERE id=?").run(name, description, cat, vegV, avail, iid);
      if (image) await db.prepare("UPDATE items SET image=? WHERE id=?").run(image, iid);
      await db.prepare("DELETE FROM portions WHERE item_id=?").run(iid);
    } else {
      itemId = Number((await db.prepare("INSERT INTO items(restaurant_id,category_id,name,description,image,veg,available) VALUES(?,?,?,?,?,?,?)").run(rid, cat, name, description, image ?? null, vegV, avail)).lastInsertRowid);
    }
    for (let i = 0; i < portions.length; i++) await db.prepare("INSERT INTO portions(item_id,label,price_paise,available) VALUES(?,?,?,?)").run(itemId, portions[i].label, portions[i].paise, unavail.has(String(i)) ? 0 : 1);
  });
  try { await tx(); } catch { fail("Item not found."); }
  await log(null, "item_saved", `r${rid}`);
  await after(res, rid, "Item saved.");
});
router.post("/admin/items/:id/toggle", async (req, res) => {
  const { rid } = await menuAdmin(req);
  await db.prepare("UPDATE items SET available=1-available WHERE id=? AND restaurant_id=?").run(id(req), rid);
  await after(res, rid, "Updated.");
});
router.delete("/admin/items/:id", async (req, res) => {
  const { rid } = await menuAdmin(req);
  await db.prepare("UPDATE items SET deleted=1, available=0 WHERE id=? AND restaurant_id=?").run(id(req), rid); // soft delete keeps history sane (MENU-09)
  ok(res, { message: "Item deleted." });
});

// ---------- Tables ----------
router.get("/admin/tables", async (req, res) => {
  const u = await requireRestAdmin(req);
  ok(res, { tables: await db.prepare("SELECT * FROM tables_ WHERE restaurant_id=? ORDER BY id").all(u.restaurant_id) });
});
router.post("/admin/tables", async (req, res) => {
  const { rid } = await menuAdmin(req); const name = str(req.body?.name);
  if (!name) fail("Please enter a table name or number.");
  try { await db.prepare("INSERT INTO tables_(restaurant_id,name) VALUES(?,?)").run(rid, name); } catch { fail("A table with that name already exists."); }
  await after(res, rid, "Table added.");
});
router.patch("/admin/tables/:id", async (req, res) => {
  const { rid } = await menuAdmin(req); const tid = id(req);
  try { await db.prepare("UPDATE tables_ SET name=? WHERE id=? AND restaurant_id=?").run(str(req.body?.name), tid, rid); } catch { fail("A table with that name already exists."); }
  ok(res, { message: "Saved." });
});
router.post("/admin/tables/:id/toggle", async (req, res) => {
  const { rid } = await menuAdmin(req);
  await db.prepare("UPDATE tables_ SET active=1-active WHERE id=? AND restaurant_id=?").run(id(req), rid);
  await after(res, rid, "Updated."); // existing orders untouched (TBL-04)
});

// ---------- Payments / UPI ----------
router.get("/admin/payments", async (req, res) => {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  const owed = await db.prepare("SELECT * FROM orders WHERE restaurant_id=? AND payment_status='pending' AND status!='cancelled' ORDER BY created_at").all(r.id);
  ok(res, { restaurant: r, owed });
});
router.post("/admin/upi", upload.single("upi"), async (req, res) => {
  const { rid } = await menuAdmin(req);
  const r = await saveUpload(req.file);
  if (!r) return fail("Please choose an image of your UPI QR code.");
  if ("error" in r) return fail(r.error);
  await db.prepare("UPDATE restaurants SET upi_qr=? WHERE id=?").run(r.name, rid);
  await after(res, rid, "UPI QR code saved.");
});

// ---------- Orders ----------
const PAGE = 20;
router.get("/admin/orders", async (req, res) => {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  if (r.state === "pending") return ok(res, { restaurant: { state: r.state }, orders: [], hasMore: false, pendingCount: 0, tables: [] });
  const q = req.query;
  const status = ["pending", "completed", "cancelled"].includes(str(q.status)) ? str(q.status) : "";
  const pay = ["pending", "paid"].includes(str(q.pay)) ? str(q.pay) : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(q.date)) ? str(q.date) : "";
  const page = Math.max(1, Math.floor(Number(q.p)) || 1);
  const where = ["restaurant_id=?"], args: (string | number)[] = [r.id];
  if (status) { where.push("status=?"); args.push(status); }
  if (pay) { where.push("payment_status=?"); args.push(pay); }
  if (date) { where.push("(created_at AT TIME ZONE 'Asia/Kolkata')::date=?::date"); args.push(date); }
  const rows = (await db.prepare(`SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, PAGE + 1, (page - 1) * PAGE)) as { id: number }[];
  const pendingCount = ((await db.prepare("SELECT COUNT(*) c FROM orders WHERE restaurant_id=? AND status='pending'").get(r.id)) as { c: number }).c;
  const tables = await db.prepare("SELECT id,name FROM tables_ WHERE restaurant_id=? AND active=1").all(r.id);
  const orders = [];
  for (const o of rows.slice(0, PAGE)) orders.push({ ...o, lines: await db.prepare("SELECT * FROM order_lines WHERE order_id=?").all(o.id), cr: (await db.prepare("SELECT * FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o.id)) ?? null });
  ok(res, { restaurant: { state: r.state }, orders, hasMore: rows.length > PAGE, pendingCount, tables });
});

type Order = { id: number; status: string; payment_status: string; payment_method: string; table_name: string; table_id: number; total_paise: number };
async function orderCtx(req: Request) {
  const u = await requireRestAdmin(req);
  const r = await own(u.restaurant_id);
  if (r.state === "pending") fail("Orders are not available yet.", 403, "/admin");
  const o = (await db.prepare("SELECT * FROM orders WHERE id=? AND restaurant_id=?").get(id(req), r.id)) as Order | undefined;
  if (!o) return fail("Order not found.", 404, "/admin/orders");
  return { u, r, o };
}

router.post("/admin/orders/:id/prep", async (req, res) => {
  const { o } = await orderCtx(req); const m = Math.round(num(req.body?.minutes));
  if (o.status !== "pending") fail("This order is already closed.");
  if (!(m >= 0 && m <= 600)) fail("Enter minutes between 0 and 600.");
  await db.prepare("UPDATE orders SET prep_minutes=?, updated_at=datetime('now') WHERE id=?").run(m, o.id);
  ok(res, { message: "Preparation time updated." });
});
router.post("/admin/orders/:id/complete", async (req, res) => {
  const { u, o } = await orderCtx(req);
  const r = await db.prepare("UPDATE orders SET status='completed', updated_at=datetime('now') WHERE id=? AND status='pending'").run(o.id);
  if (!r.changes) fail("This order was already closed.", 409);
  await log(u.id, "order_completed", String(o.id));
  ok(res, { message: "Order marked completed." });
});
router.post("/admin/orders/:id/pay", async (req, res) => {
  const { u, r, o } = await orderCtx(req);
  if (r.state !== "active") fail("Payments can only be confirmed while the restaurant is active."); // PAY-05
  if (o.status === "cancelled") fail("This order is cancelled; payment cannot be confirmed."); // CAN-08
  const rs = await db.prepare("UPDATE orders SET payment_status='paid', paid_by=?, paid_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND payment_status='pending' AND status!='cancelled'").run(u.id, o.id);
  if (!rs.changes) fail("Already confirmed.", 409);
  await log(u.id, "payment_confirmed", `order ${o.id} ${o.payment_method} ${o.total_paise}`);
  ok(res, { message: "Payment marked as paid." });
});
router.post("/admin/orders/:id/cancel-decision", async (req, res) => {
  const { u, o } = await orderCtx(req); const approve = str(req.body?.decision) === "approve";
  const tx = db.transaction(async () => {
    const c = await db.prepare("UPDATE cancel_requests SET status=?, decided_at=datetime('now') WHERE order_id=? AND status='requested'").run(approve ? "approved" : "rejected", o.id);
    if (!c.changes) return false; // first decision wins (CAN-05)
    if (approve) await db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id=? AND status='pending'").run(o.id);
    return true;
  });
  if (!(await tx())) fail("Already decided.", 409);
  await log(u.id, approve ? "cancel_approved" : "cancel_rejected", String(o.id));
  ok(res, { message: approve ? "Order cancelled." : "Cancellation declined." });
});
router.post("/admin/orders/:id/table", async (req, res) => {
  const { u, o, r } = await orderCtx(req);
  const tid = num(req.body?.table_id);
  const t = Number.isInteger(tid) ? (await db.prepare("SELECT id,name FROM tables_ WHERE id=? AND restaurant_id=? AND active=1").get(tid, r.id)) as { id: number; name: string } | undefined : undefined;
  if (!t) return fail("Choose an active table.");
  if (o.status !== "pending") fail("Closed orders cannot be moved.");
  await db.prepare("INSERT INTO table_moves(order_id,from_table,to_table,by_user) VALUES(?,?,?,?)").run(o.id, o.table_name, t.name, u.id);
  await db.prepare("UPDATE orders SET table_id=?, table_name=?, updated_at=datetime('now') WHERE id=?").run(t.id, t.name, o.id);
  await log(u.id, "table_reassigned", `${o.id}: ${o.table_name}→${t.name}`);
  ok(res, { message: "Table changed." });
});
