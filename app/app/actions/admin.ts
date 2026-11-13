"use server";
import { db, log } from "@/lib/db";
import { requireRestAdmin } from "@/lib/auth";
import { go } from "@/lib/flash";
import { getRestaurant, maybeActivate, application, normPhone } from "@/lib/restaurant";
import { saveImage } from "@/lib/files";

const s = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
const n = (fd: FormData, k: string) => Number(fd.get(k));

/** Admin may edit setup data once approved (or while Returned/Draft for info). */
async function setupAdmin() {
  const u = await requireRestAdmin();
  const app = application(u.restaurant_id);
  return { u, rid: u.restaurant_id, approved: app?.state === "approved", app };
}
async function menuAdmin(back: string) {
  const c = await setupAdmin();
  if (!c.approved) go("/admin", "This unlocks after your application is approved.", true);
  return { ...c, back };
}
const after = (rid: number, back: string, msg: string): never => { maybeActivate(rid); go(back, msg); };

// ---------- Categories ----------
export async function addCategory(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu"); const name = s(fd, "name");
  if (!name) go(back, "Please enter a category name.", true);
  const pos = (db.prepare("SELECT COALESCE(MAX(position),0)+1 p FROM categories WHERE restaurant_id=?").get(rid) as { p: number }).p;
  db.prepare("INSERT INTO categories(restaurant_id,name,position) VALUES(?,?,?)").run(rid, name, pos);
  after(rid, back, "Category added.");
}
export async function renameCategory(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu");
  db.prepare("UPDATE categories SET name=? WHERE id=? AND restaurant_id=?").run(s(fd, "name"), n(fd, "id"), rid);
  go(back, "Saved.");
}
export async function moveCategory(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu");
  const cats = db.prepare("SELECT id FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid) as { id: number }[];
  const i = cats.findIndex((c) => c.id === n(fd, "id")), j = i + (s(fd, "dir") === "up" ? -1 : 1);
  if (i >= 0 && j >= 0 && j < cats.length) { [cats[i], cats[j]] = [cats[j], cats[i]]; cats.forEach((c, k) => db.prepare("UPDATE categories SET position=? WHERE id=?").run(k + 1, c.id)); }
  go(back);
}
export async function deleteCategory(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu"); const id = n(fd, "id");
  if (db.prepare("SELECT 1 FROM items WHERE category_id=? AND restaurant_id=? AND deleted=0").get(id, rid)) go(back, "Move or remove the items in this category first.", true);
  db.prepare("DELETE FROM categories WHERE id=? AND restaurant_id=?").run(id, rid);
  go(back, "Category deleted.");
}

// ---------- Items ----------
export async function saveItem(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu");
  const id = n(fd, "id") || 0, name = s(fd, "name");
  const cat = n(fd, "category_id"), veg = s(fd, "veg");
  const labels = fd.getAll("plabel").map(String), prices = fd.getAll("pprice").map(String);
  const portions: { label: string; paise: number }[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (!prices[i].trim() && !labels[i].trim()) continue;
    const v = Number(prices[i]);
    if (!(v > 0) || v > 1_000_000) go(back, "Every portion needs a valid price above zero.", true);
    portions.push({ label: labels[i].trim(), paise: Math.round(v * 100) });
  }
  if (!name || portions.length === 0) go(back, "Item name and at least one price are required.", true);
  if (portions.length > 1 && portions.some((p) => !p.label)) go(back, "When there are several portions, each needs a label.", true);
  if (!db.prepare("SELECT 1 FROM categories WHERE id=? AND restaurant_id=?").get(cat, rid)) go(back, "Choose a category.", true);

  let image: string | undefined;
  const f = fd.get("image");
  if (f instanceof File && f.size > 0) { const r = await saveImage(f); if ("error" in r) go(back, r.error, true); image = r.name; }

  const vegV = veg === "1" ? 1 : veg === "0" ? 0 : null, avail = fd.get("available") ? 1 : 0;
  const tx = db.transaction(() => {
    let itemId = id;
    if (id) {
      if (!db.prepare("SELECT 1 FROM items WHERE id=? AND restaurant_id=?").get(id, rid)) throw new Error("nf");
      db.prepare("UPDATE items SET name=?,description=?,category_id=?,veg=?,available=? WHERE id=?").run(name, s(fd, "description"), cat, vegV, avail, id);
      if (image) db.prepare("UPDATE items SET image=? WHERE id=?").run(image, id);
      db.prepare("DELETE FROM portions WHERE item_id=?").run(id);
    } else {
      itemId = Number(db.prepare("INSERT INTO items(restaurant_id,category_id,name,description,image,veg,available) VALUES(?,?,?,?,?,?,?)").run(rid, cat, name, s(fd, "description"), image ?? null, vegV, avail).lastInsertRowid);
    }
    const unavail = new Set(fd.getAll("punavail").map(String));
    portions.forEach((p, i) => db.prepare("INSERT INTO portions(item_id,label,price_paise,available) VALUES(?,?,?,?)").run(itemId, p.label, p.paise, unavail.has(String(i)) ? 0 : 1));
  });
  try { tx(); } catch { go(back, "Item not found.", true); }
  log(null, "item_saved", `r${rid}`);
  after(rid, back, "Item saved.");
}
export async function toggleItem(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu");
  db.prepare("UPDATE items SET available=1-available WHERE id=? AND restaurant_id=?").run(n(fd, "id"), rid);
  after(rid, back, "Updated.");
}
export async function deleteItem(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/menu");
  db.prepare("UPDATE items SET deleted=1, available=0 WHERE id=? AND restaurant_id=?").run(n(fd, "id"), rid); // soft delete keeps history sane (MENU-09)
  go(back, "Item deleted.");
}

// ---------- Tables ----------
export async function addTable(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/tables"); const name = s(fd, "name");
  if (!name) go(back, "Please enter a table name or number.", true);
  try { db.prepare("INSERT INTO tables_(restaurant_id,name) VALUES(?,?)").run(rid, name); } catch { go(back, "A table with that name already exists.", true); }
  after(rid, back, "Table added.");
}
export async function renameTable(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/tables");
  try { db.prepare("UPDATE tables_ SET name=? WHERE id=? AND restaurant_id=?").run(s(fd, "name"), n(fd, "id"), rid); } catch { go(back, "A table with that name already exists.", true); }
  go(back, "Saved.");
}
export async function toggleTable(fd: FormData) {
  const { rid, back } = await menuAdmin("/admin/tables");
  db.prepare("UPDATE tables_ SET active=1-active WHERE id=? AND restaurant_id=?").run(n(fd, "id"), rid);
  after(rid, back, "Updated."); // existing orders untouched (TBL-04)
}

// ---------- Restaurant info / UPI ----------
export async function saveInfo(fd: FormData) {
  const { u, rid, app } = await setupAdmin();
  const name = s(fd, "name"), phone = s(fd, "phone");
  if (!name || !s(fd, "address") || normPhone(phone).length !== 10) go("/admin/info", "Name, address and a valid 10-digit contact number are required.", true);
  db.prepare("UPDATE restaurants SET name=?,description=?,address=?,phone=?,phone_norm=?,type=?,fssai=?,gstin=? WHERE id=?")
    .run(name, s(fd, "description"), s(fd, "address"), phone, normPhone(phone), s(fd, "type"), s(fd, "fssai") || null, s(fd, "gstin") || null, rid);
  log(u.id, "info_saved", `r${rid} app=${app?.state}`);
  go("/admin/info", "Saved.");
}
export async function uploadUpi(fd: FormData) {
  const { rid } = await menuAdmin("/admin/payments");
  const f = fd.get("upi");
  if (!(f instanceof File) || f.size === 0) go("/admin/payments", "Please choose an image of your UPI QR code.", true);
  const r = await saveImage(f); if ("error" in r) go("/admin/payments", r.error, true);
  db.prepare("UPDATE restaurants SET upi_qr=? WHERE id=?").run(r.name, rid);
  after(rid, "/admin/payments", "UPI QR code saved.");
}

// ---------- Orders ----------
async function orderCtx(id: number) {
  const u = await requireRestAdmin();
  const r = getRestaurant(u.restaurant_id)!;
  if (r.state === "pending") go("/admin", "Orders are not available yet.", true);
  const o = db.prepare("SELECT * FROM orders WHERE id=? AND restaurant_id=?").get(id, r.id) as { id: number; status: string; payment_status: string; payment_method: string; table_name: string; table_id: number; total_paise: number } | undefined;
  if (!o) go("/admin/orders", "Order not found.", true);
  return { u, r, o };
}
const back = (fd: FormData) => { const b = s(fd, "back"); return b.startsWith("/admin") ? b : "/admin/orders"; };

export async function setPrep(fd: FormData) {
  const { o } = await orderCtx(n(fd, "id")); const m = Math.round(n(fd, "minutes"));
  if (o.status !== "pending") go(back(fd), "This order is already closed.", true);
  if (!(m >= 0 && m <= 600)) go(back(fd), "Enter minutes between 0 and 600.", true);
  db.prepare("UPDATE orders SET prep_minutes=?, updated_at=datetime('now') WHERE id=?").run(m, o.id);
  go(back(fd), "Preparation time updated.");
}
export async function completeOrder(fd: FormData) {
  const { u, o } = await orderCtx(n(fd, "id"));
  const r = db.prepare("UPDATE orders SET status='completed', updated_at=datetime('now') WHERE id=? AND status='pending'").run(o.id);
  if (r.changes) log(u.id, "order_completed", String(o.id));
  go(back(fd), r.changes ? "Order marked completed." : "This order was already closed.", !r.changes);
}
export async function confirmPayment(fd: FormData) {
  const { u, r, o } = await orderCtx(n(fd, "id"));
  if (r.state !== "active") go(back(fd), "Payments can only be confirmed while the restaurant is active.", true); // PAY-05
  if (o.status === "cancelled") go(back(fd), "This order is cancelled; payment cannot be confirmed.", true); // CAN-08
  const res = db.prepare("UPDATE orders SET payment_status='paid', paid_by=?, paid_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND payment_status='pending' AND status!='cancelled'").run(u.id, o.id);
  if (res.changes) log(u.id, "payment_confirmed", `order ${o.id} ${o.payment_method} ${o.total_paise}`);
  go(back(fd), res.changes ? "Payment marked as paid." : "Already confirmed.", !res.changes);
}
export async function decideCancel(fd: FormData) {
  const { u, o } = await orderCtx(n(fd, "id")); const approve = s(fd, "decision") === "approve";
  const tx = db.transaction(() => {
    const c = db.prepare("UPDATE cancel_requests SET status=?, decided_at=datetime('now') WHERE order_id=? AND status='requested'").run(approve ? "approved" : "rejected", o.id);
    if (!c.changes) return false; // first decision wins (CAN-05)
    if (approve) db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id=? AND status='pending'").run(o.id);
    return true;
  });
  const done = tx();
  if (done) log(u.id, approve ? "cancel_approved" : "cancel_rejected", String(o.id));
  go(back(fd), done ? (approve ? "Order cancelled." : "Cancellation declined.") : "Already decided.", !done);
}
export async function reassignTable(fd: FormData) {
  const { u, o, r } = await orderCtx(n(fd, "id"));
  const t = db.prepare("SELECT id,name FROM tables_ WHERE id=? AND restaurant_id=? AND active=1").get(n(fd, "table_id"), r.id) as { id: number; name: string } | undefined;
  if (!t) go(back(fd), "Choose an active table.", true);
  if (o.status !== "pending") go(back(fd), "Closed orders cannot be moved.", true);
  db.prepare("INSERT INTO table_moves(order_id,from_table,to_table,by_user) VALUES(?,?,?,?)").run(o.id, o.table_name, t.name, u.id);
  db.prepare("UPDATE orders SET table_id=?, table_name=?, updated_at=datetime('now') WHERE id=?").run(t.id, t.name, o.id);
  log(u.id, "table_reassigned", `${o.id}: ${o.table_name}→${t.name}`);
  go(back(fd), "Table changed.");
}
