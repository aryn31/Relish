"use server";
import crypto from "crypto";
import { db, log, rateOk, setting } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant";
import { go } from "@/lib/flash";

type In = { portionId: number; qty: number };
export type CheckedLine = { portionId: number; itemName: string; portionName: string; price: number; qty: number; ok: boolean };
export type CheckResult = { open: boolean; lines: CheckedLine[]; tables: { id: number; name: string }[]; total: number };

async function resolve(rid: number, lines: In[]): Promise<CheckedLine[]> {
  return Promise.all(lines.map(async (l) => {
    const p = (await db.prepare(`SELECT p.id,p.label,p.price_paise,p.available pa,i.name,i.available ia,i.deleted FROM portions p JOIN items i ON i.id=p.item_id WHERE p.id=? AND i.restaurant_id=?`).get(l.portionId, rid)) as any;
    const qty = Math.max(1, Math.min(50, Math.floor(l.qty) || 1));
    return p ? { portionId: p.id, itemName: p.name, portionName: p.label, price: p.price_paise, qty, ok: !!p.pa && !!p.ia && !p.deleted }
             : { portionId: l.portionId, itemName: "Unavailable item", portionName: "", price: 0, qty, ok: false };
  }));
}

/** Revalidate a cart against current server data (MENU-06/07/08, CART-05). */
export async function checkCart(restaurantId: number, lines: In[]): Promise<CheckResult> {
  const r = await getRestaurant(restaurantId);
  const open = r?.state === "active";
  const out = r ? await resolve(r.id, lines.slice(0, 100)) : [];
  const tables = r && open ? (await db.prepare("SELECT id,name FROM tables_ WHERE restaurant_id=? AND active=1 ORDER BY id").all(r.id) as { id: number; name: string }[]) : [];
  return { open, lines: out, tables, total: out.filter((l) => l.ok).reduce((s, l) => s + l.price * l.qty, 0) };
}

export type PlaceResult = { error: string } | { publicId: string };

export async function placeOrder(input: { restaurantId: number; lines: (In & { expectedPrice: number })[]; tableId: number; method: "upi" | "cash"; idem: string }): Promise<PlaceResult> {
  const u = await getUser();
  if (!u || u.role !== "customer") return { error: "Please sign in as a customer to place an order." };
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(input.idem)) return { error: "Invalid request." };
  if (!["upi", "cash"].includes(input.method)) return { error: "Choose a payment option." };
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 100) return { error: "Your cart is empty." };

  const idemKey = `${u.id}:${input.idem}`;
  const existing = await db.prepare("SELECT public_id FROM orders WHERE idem_key=? AND customer_id=?").get(idemKey, u.id) as { public_id: string } | undefined;
  if (existing) return { publicId: existing.public_id }; // retry → same result (CART-08)
  if (!await rateOk(`order:${u.id}`, 10, 600)) return { error: "Too many orders in a short time. Please wait a few minutes." };

  const tx = db.transaction(async (): Promise<PlaceResult> => {
    const r = await getRestaurant(input.restaurantId);
    if (!r || r.state !== "active") return { error: "This restaurant is currently unavailable." };
    const t = await db.prepare("SELECT id,name FROM tables_ WHERE id=? AND restaurant_id=? AND active=1").get(input.tableId, r.id) as { id: number; name: string } | undefined;
    if (!t) return { error: "Please choose an active table." };
    const lines = await resolve(r.id, input.lines);
    if (lines.some((l) => !l.ok)) return { error: "Some items are no longer available. Please review your cart." };
    if (lines.some((l, i) => l.price !== input.lines[i].expectedPrice)) return { error: "Prices have changed. Please review and confirm the new prices." };
    const cap = await setting("max_pending_per_restaurant", 5);
    const pend = (await db.prepare("SELECT COUNT(*) c FROM orders WHERE customer_id=? AND restaurant_id=? AND status='pending'").get(u.id, r.id) as { c: number }).c;
    if (pend >= cap) return { error: `You already have ${cap} pending orders here. Please wait for some to be completed.` };
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    await db.prepare("UPDATE restaurants SET order_seq=order_seq+1 WHERE id=?").run(r.id);
    const num = (await db.prepare("SELECT order_seq s FROM restaurants WHERE id=?").get(r.id) as { s: number }).s;
    const pub = crypto.randomBytes(12).toString("hex");
    const oid = Number((await db.prepare("INSERT INTO orders(restaurant_id,customer_id,number,table_id,table_name,payment_method,total_paise,idem_key,public_id) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(r.id, u.id, num, t.id, t.name, input.method, total, idemKey, pub)).lastInsertRowid);
    for (const l of lines) await db.prepare("INSERT INTO order_lines(order_id,item_name,portion_name,qty,unit_paise,line_paise) VALUES(?,?,?,?,?,?)").run(oid, l.itemName, l.portionName, l.qty, l.price, l.price * l.qty);
    return { publicId: pub };
  });
  try { return await tx(); }
  catch (e: any) {
    const again = await db.prepare("SELECT public_id FROM orders WHERE idem_key=?").get(idemKey) as { public_id: string } | undefined;
    return again ? { publicId: again.public_id } : { error: "Something went wrong. Please try again." };
  }
}

async function myOrder(fd: FormData) {
  const u = await getUser(); const pid = String(fd.get("pid") || "");
  if (!u) go(`/login?next=/orders/${pid}`);
  const o = await db.prepare("SELECT * FROM orders WHERE public_id=? AND customer_id=?").get(pid, u.id) as { id: number; status: string; payment_status: string; restaurant_id: number } | undefined;
  if (!o) go("/orders", "Order not found.", true);
  return { u, o, pid };
}

export async function reportPaid(fd: FormData) {
  const { o, pid } = await myOrder(fd);
  if (o.payment_status === "pending" && o.status !== "cancelled") await db.prepare("UPDATE orders SET claimed_paid=1, updated_at=datetime('now') WHERE id=?").run(o.id); // claim only (PAY-03)
  go(`/orders/${pid}`, "Thanks. The restaurant will confirm your payment.");
}
export async function switchMethod(fd: FormData) {
  const { o, pid } = await myOrder(fd); const m = String(fd.get("method"));
  if (!["upi", "cash"].includes(m)) go(`/orders/${pid}`);
  if (o.payment_status === "pending" && o.status === "pending") await db.prepare("UPDATE orders SET payment_method=?, claimed_paid=0, updated_at=datetime('now') WHERE id=?").run(m, o.id);
  go(`/orders/${pid}`, "Payment option updated.");
}
export async function requestCancel(fd: FormData) {
  const { u, o, pid } = await myOrder(fd); const reason = String(fd.get("reason") || "").trim().slice(0, 300);
  if (!reason) go(`/orders/${pid}`, "Please tell us the reason.", true);
  if (o.status !== "pending") go(`/orders/${pid}`, "This order can no longer be cancelled.", true);
  const prior = (await db.prepare("SELECT COUNT(*) c FROM cancel_requests WHERE order_id=?").get(o.id) as { c: number }).c;
  if (prior >= 2) go(`/orders/${pid}`, "You have reached the limit of cancellation requests for this order.", true);
  const last = await db.prepare("SELECT reason FROM cancel_requests WHERE order_id=? ORDER BY id DESC LIMIT 1").get(o.id) as { reason: string } | undefined;
  if (last && last.reason.toLowerCase() === reason.toLowerCase()) go(`/orders/${pid}`, "Please give a new reason.", true);
  try { await db.prepare("INSERT INTO cancel_requests(order_id,reason) VALUES(?,?)").run(o.id, reason); } // unique partial index → one open request
  catch { go(`/orders/${pid}`, "A request is already waiting for the restaurant.", true); }
  await log(u.id, "cancel_requested", String(o.id));
  go(`/orders/${pid}`, "Cancellation requested. The restaurant will decide.");
}
