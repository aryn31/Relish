import { Router, type Request } from "express";
import crypto from "crypto";
import { db, log, rateOk, setting } from "../db";
import { ok, fail, str } from "../http";
import { currentUser, requireUser } from "../auth";
import { getRestaurant } from "../restaurant";

// Owns: /api/cart/*, /api/orders*
export const router = Router();

type In = { portionId: number; qty: number };
export type CheckedLine = { portionId: number; itemName: string; portionName: string; price: number; qty: number; ok: boolean };
type PlaceResult = { error: string } | { publicId: string };

async function resolve(rid: number, lines: In[]): Promise<CheckedLine[]> {
  return Promise.all(lines.map(async (l) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (await db.prepare(`SELECT p.id,p.label,p.price_paise,p.available pa,i.name,i.available ia,i.deleted FROM portions p JOIN items i ON i.id=p.item_id WHERE p.id=? AND i.restaurant_id=?`).get(l.portionId, rid)) as any;
    const qty = Math.max(1, Math.min(50, Math.floor(l.qty) || 1));
    return p ? { portionId: p.id, itemName: p.name, portionName: p.label, price: p.price_paise, qty, ok: !!p.pa && !!p.ia && !p.deleted }
             : { portionId: l.portionId, itemName: "Unavailable item", portionName: "", price: 0, qty, ok: false };
  }));
}
const cleanLines = (v: unknown): In[] => (Array.isArray(v) ? v : []).map((l) => ({ portionId: Number(l?.portionId) || 0, qty: Number(l?.qty) }));

/** Revalidate a cart against current server data (MENU-06/07/08, CART-05).
 *  Body: { restaurantId, lines: [{portionId, qty}] } → { open, lines, tables, total } */
router.post("/cart/check", async (req, res) => {
  const r = await getRestaurant(Number(req.body?.restaurantId) || 0);
  const open = r?.state === "active";
  const out = r ? await resolve(r.id, cleanLines(req.body?.lines).slice(0, 100)) : [];
  const tables = r && open ? (await db.prepare("SELECT id,name FROM tables_ WHERE restaurant_id=? AND active=1 ORDER BY id").all(r.id) as { id: number; name: string }[]) : [];
  ok(res, { open, lines: out, tables, total: out.filter((l) => l.ok).reduce((s, l) => s + l.price * l.qty, 0) });
});

/** Place an order (idempotent per customer + idem key).
 *  Body: { restaurantId, lines: [{portionId, qty, expectedPrice}], tableId, method, idem } → { publicId } or { error } */
router.post("/orders", async (req, res) => {
  const input = req.body ?? {};
  const u = await currentUser(req);
  if (!u || u.role !== "customer") fail("Please sign in as a customer to place an order.", 401);
  const uid = u!.id;
  const idem = String(input.idem ?? "");
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(idem)) fail("Invalid request.");
  if (!["upi", "cash"].includes(input.method)) fail("Choose a payment option.");
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) fail("Your cart is empty.");
  const inLines = (input.lines as unknown[]).map((l: any) => ({ portionId: Number(l?.portionId) || 0, qty: Number(l?.qty), expectedPrice: Number(l?.expectedPrice) })); // eslint-disable-line @typescript-eslint/no-explicit-any

  const idemKey = `${uid}:${idem}`;
  const existing = await db.prepare("SELECT public_id FROM orders WHERE idem_key=? AND customer_id=?").get(idemKey, uid) as { public_id: string } | undefined;
  if (existing) return ok(res, { publicId: existing.public_id }); // retry → same result (CART-08)
  if (!await rateOk(`order:${uid}`, 10, 600)) fail("Too many orders in a short time. Please wait a few minutes.", 429);

  const tx = db.transaction(async (): Promise<PlaceResult> => {
    const r = await getRestaurant(Number(input.restaurantId) || 0);
    if (!r || r.state !== "active") return { error: "This restaurant is currently unavailable." };
    const t = await db.prepare("SELECT id,name FROM tables_ WHERE id=? AND restaurant_id=? AND active=1").get(Number(input.tableId) || 0, r.id) as { id: number; name: string } | undefined;
    if (!t) return { error: "Please choose an active table." };
    const lines = await resolve(r.id, inLines);
    if (lines.some((l) => !l.ok)) return { error: "Some items are no longer available. Please review your cart." };
    if (lines.some((l, i) => l.price !== inLines[i].expectedPrice)) return { error: "Prices have changed. Please review and confirm the new prices." };
    const cap = await setting("max_pending_per_restaurant", 5);
    const pend = (await db.prepare("SELECT COUNT(*) c FROM orders WHERE customer_id=? AND restaurant_id=? AND status='pending'").get(uid, r.id) as { c: number }).c;
    if (pend >= cap) return { error: `You already have ${cap} pending orders here. Please wait for some to be completed.` };
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    await db.prepare("UPDATE restaurants SET order_seq=order_seq+1 WHERE id=?").run(r.id);
    const num = (await db.prepare("SELECT order_seq s FROM restaurants WHERE id=?").get(r.id) as { s: number }).s;
    const pub = crypto.randomBytes(12).toString("hex");
    const oid = Number((await db.prepare("INSERT INTO orders(restaurant_id,customer_id,number,table_id,table_name,payment_method,total_paise,idem_key,public_id) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(r.id, uid, num, t.id, t.name, input.method, total, idemKey, pub)).lastInsertRowid);
    for (const l of lines) await db.prepare("INSERT INTO order_lines(order_id,item_name,portion_name,qty,unit_paise,line_paise) VALUES(?,?,?,?,?,?)").run(oid, l.itemName, l.portionName, l.qty, l.price, l.price * l.qty);
    return { publicId: pub };
  });
  let out: PlaceResult;
  try { out = await tx(); }
  catch {
    const again = await db.prepare("SELECT public_id FROM orders WHERE idem_key=?").get(idemKey) as { public_id: string } | undefined;
    out = again ? { publicId: again.public_id } : { error: "Something went wrong. Please try again." };
  }
  if ("error" in out) fail(out.error, 409);
  ok(res, out);
});

/** The signed-in user's orders (newest first). */
router.get("/orders", async (req, res) => {
  const u = await requireUser(req);
  const orders = await db.prepare("SELECT o.id, o.public_id, o.number, o.status, o.payment_status, o.table_name, o.total_paise, o.created_at, r.name rname, (SELECT image FROM items WHERE restaurant_id=r.id AND deleted=0 AND image IS NOT NULL ORDER BY id LIMIT 1) cover FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.customer_id=? ORDER BY o.id DESC LIMIT 100").all(u.id);
  ok(res, { orders });
});

/** One of the signed-in user's orders. ROLE-04/AUTH-07: customers only see their own orders.
 *  → { order: {..., has_upi_qr}, lines, cancel } ; 404 when not theirs. */
router.get("/orders/:pid", async (req, res) => {
  const u = await requireUser(req);
  const o = await db.prepare("SELECT o.id, o.public_id, o.number, o.status, o.payment_status, o.payment_method, o.claimed_paid, o.prep_minutes, o.table_name, o.total_paise, o.created_at, r.name rname, r.slug, r.state rstate, (r.upi_qr IS NOT NULL) has_upi_qr FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.public_id=? AND o.customer_id=?").get(String(req.params.pid), u.id) as { id: number } | undefined;
  if (!o) fail("Order not found.", 404);
  const lines = await db.prepare("SELECT id, item_name, portion_name, qty, unit_paise, line_paise FROM order_lines WHERE order_id=?").all(o!.id);
  const cancel = (await db.prepare("SELECT status, reason FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o!.id)) ?? null;
  ok(res, { order: o, lines, cancel });
});

async function myOrder(req: Request) {
  const u = await requireUser(req); const pid = String(req.params.pid);
  const o = await db.prepare("SELECT * FROM orders WHERE public_id=? AND customer_id=?").get(pid, u.id) as { id: number; status: string; payment_status: string; restaurant_id: number } | undefined;
  if (!o) fail("Order not found.", 404, "/orders");
  return { u, o: o!, pid };
}

/** Customer says they paid by UPI (claim only, PAY-03). */
router.post("/orders/:pid/paid", async (req, res) => {
  const { o } = await myOrder(req);
  if (o.payment_status === "pending" && o.status !== "cancelled") await db.prepare("UPDATE orders SET claimed_paid=1, updated_at=datetime('now') WHERE id=?").run(o.id);
  ok(res, { message: "Thanks. The restaurant will confirm your payment." });
});

/** Body: { method: "upi" | "cash" } */
router.post("/orders/:pid/method", async (req, res) => {
  const { o } = await myOrder(req); const m = String(req.body?.method);
  if (!["upi", "cash"].includes(m)) return ok(res); // no message, just back to the order
  if (o.payment_status === "pending" && o.status === "pending") await db.prepare("UPDATE orders SET payment_method=?, claimed_paid=0, updated_at=datetime('now') WHERE id=?").run(m, o.id);
  ok(res, { message: "Payment option updated." });
});

/** Body: { reason } */
router.post("/orders/:pid/cancel", async (req, res) => {
  const { u, o } = await myOrder(req); const reason = str(req.body?.reason).slice(0, 300);
  if (!reason) fail("Please tell us the reason.");
  if (o.status !== "pending") fail("This order can no longer be cancelled.");
  const prior = (await db.prepare("SELECT COUNT(*) c FROM cancel_requests WHERE order_id=?").get(o.id) as { c: number }).c;
  if (prior >= 2) fail("You have reached the limit of cancellation requests for this order.");
  const last = await db.prepare("SELECT reason FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o.id) as { reason: string } | undefined;
  if (last && last.reason.toLowerCase() === reason.toLowerCase()) fail("Please give a new reason.");
  try { await db.prepare("INSERT INTO cancel_requests(order_id,reason) VALUES(?,?)").run(o.id, reason); } // unique partial index → one open request
  catch { fail("A request is already waiting for the restaurant.", 409); }
  await log(u.id, "cancel_requested", String(o.id));
  ok(res, { message: "Cancellation requested. The restaurant will decide." });
});
