// Demo data: `npm run seed`. Safe to re-run (skips if already seeded).
import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { db, pool } from "../src/db";
import { storeImage } from "../src/files";

const PASS = "Demo@1234";
const hash = bcrypt.hashSync(PASS, 10);

/* tiny PNG encoder for soft gradient "photo" placeholders */
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(rgb: [number, number, number], size = 160) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - size / 2, y - size / 2) / size, f = 1.15 - d * 0.9; const o = y * (size * 3 + 1) + 1 + x * 3;
    for (let i = 0; i < 3; i++) raw[o + i] = Math.max(0, Math.min(255, Math.round(rgb[i] * f))); } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const save = (buf: Buffer) => storeImage(buf, "png");

type Item = { n: string; d: string; v: 0 | 1; p: [string, number][]; c: [number, number, number] };
const MENUS: Record<string, Record<string, Item[]>> = {
  veg: {
    Starters: [
      { n: "Paneer Tikka", d: "Char-grilled cottage cheese, mint chutney", v: 1, p: [["Half", 180], ["Full", 320]], c: [214, 140, 60] },
      { n: "Crispy Corn", d: "Tossed with pepper and spring onion", v: 1, p: [["", 160]], c: [226, 180, 70] },
      { n: "Hara Bhara Kebab", d: "Spinach and green pea patties", v: 1, p: [["", 170]], c: [90, 150, 80] }],
    "Main Course": [
      { n: "Dal Makhani", d: "Slow-cooked black lentils, butter and cream", v: 1, p: [["Half", 170], ["Full", 290]], c: [150, 80, 50] },
      { n: "Paneer Butter Masala", d: "Rich tomato gravy", v: 1, p: [["Half", 220], ["Full", 380]], c: [220, 110, 50] },
      { n: "Veg Biryani", d: "Fragrant basmati with seasonal vegetables", v: 1, p: [["", 260]], c: [210, 160, 80] }],
    Breads: [
      { n: "Butter Naan", d: "", v: 1, p: [["", 60]], c: [225, 190, 120] },
      { n: "Garlic Roti", d: "", v: 1, p: [["", 40]], c: [200, 160, 100] }],
    Drinks: [{ n: "Sweet Lassi", d: "Thick and chilled", v: 1, p: [["", 90]], c: [235, 225, 200] }, { n: "Masala Chai", d: "", v: 1, p: [["", 40]], c: [170, 110, 70] }],
  },
  family: {
    Starters: [{ n: "Chicken 65", d: "Spicy fried chicken, curry leaves", v: 0, p: [["Half", 220], ["Full", 400]], c: [190, 60, 40] }, { n: "Gobi Manchurian", d: "", v: 1, p: [["", 180]], c: [150, 70, 50] }],
    Mains: [
      { n: "Butter Chicken", d: "Tandoori chicken in creamy tomato gravy", v: 0, p: [["Half", 300], ["Full", 520]], c: [215, 100, 45] },
      { n: "Mutton Rogan Josh", d: "Kashmiri-style slow cooked mutton", v: 0, p: [["", 460]], c: [140, 50, 40] },
      { n: "Chicken Biryani", d: "Hyderabadi dum biryani", v: 0, p: [["Half", 240], ["Full", 420]], c: [205, 150, 70] },
      { n: "Palak Paneer", d: "", v: 1, p: [["", 250]], c: [70, 130, 70] }],
    Desserts: [{ n: "Gulab Jamun (2 pcs)", d: "", v: 1, p: [["", 90]], c: [130, 60, 40] }, { n: "Kulfi Falooda", d: "", v: 1, p: [["", 140]], c: [225, 170, 190] }],
  },
  cafe: {
    Coffee: [{ n: "Cappuccino", d: "", v: 1, p: [["Regular", 150], ["Large", 190]], c: [150, 105, 75] }, { n: "Cold Brew", d: "Steeped 18 hours", v: 1, p: [["", 180]], c: [70, 50, 40] }, { n: "Hot Chocolate", d: "", v: 1, p: [["", 170]], c: [100, 60, 45] }],
    Bites: [{ n: "Classic Margherita Pizza", d: "Fresh tomato, mozzarella, basil", v: 1, p: [["", 420]], c: [215, 90, 60] }, { n: "Creamy Alfredo Pasta", d: "Rich cream sauce, parmesan", v: 1, p: [["", 380]], c: [230, 200, 140] }, { n: "Garlic Bread", d: "", v: 1, p: [["", 180]], c: [220, 170, 80] }, { n: "Club Sandwich", d: "Chicken, egg, lettuce", v: 0, p: [["", 260]], c: [190, 150, 90] }],
    Desserts: [{ n: "Tiramisu", d: "", v: 1, p: [["", 240]], c: [180, 140, 100] }],
  },
  fast: {
    Burgers: [{ n: "Aloo Tikki Burger", d: "", v: 1, p: [["", 110]], c: [200, 140, 70] }, { n: "Chicken Zinger", d: "", v: 0, p: [["", 190]], c: [200, 100, 50] }],
    Sides: [{ n: "French Fries", d: "", v: 1, p: [["Regular", 90], ["Large", 130]], c: [230, 190, 80] }],
    Shakes: [{ n: "Oreo Shake", d: "", v: 1, p: [["", 150]], c: [90, 70, 70] }],
  },
};

type R = { slug: string; name: string; owner: string; email: string; type: string; addr: string; phone: string; about: string; menu: keyof typeof MENUS; tables: number; state: "active" | "inactive" | "pending"; app: "approved" | "submitted" | "returned" | "rejected"; fee: "confirmed" | "awaiting" | "not_assigned"; feeAmt?: number; full?: boolean };
const RESTS: R[] = [
  { slug: "the-green-fork", name: "The Green Fork", owner: "Anil Sharma", email: "owner@greenfork.demo", type: "Vegetarian restaurant", addr: "MG Road, Pune", phone: "9876500001", about: "Pure vegetarian multi-cuisine dining with a calm garden terrace.", menu: "veg", tables: 6, state: "active", app: "approved", fee: "confirmed", feeAmt: 5000, full: true },
  { slug: "spice-garden", name: "Spice Garden", owner: "Priya Verma", email: "owner@spicegarden.demo", type: "Family restaurant", addr: "Koregaon Park, Pune", phone: "9876500002", about: "North Indian classics and Hyderabadi biryani for the whole family.", menu: "family", tables: 8, state: "active", app: "approved", fee: "confirmed", feeAmt: 4500, full: true },
  { slug: "lakeview-dine", name: "Lakeview Dine", owner: "Amit Rao", email: "owner@lakeview.demo", type: "Cafe", addr: "Baner Lake Road, Pune", phone: "9876500003", about: "Coffee, pasta and pizza with a view of the lake.", menu: "cafe", tables: 5, state: "active", app: "approved", fee: "confirmed", feeAmt: 5000, full: true },
  { slug: "urban-bites", name: "Urban Bites", owner: "Neha Singh", email: "owner@urbanbites.demo", type: "Fast food", addr: "FC Road, Pune", phone: "9876500004", about: "Burgers, fries and shakes, fast.", menu: "fast", tables: 4, state: "inactive", app: "approved", fee: "confirmed", feeAmt: 3000, full: true },
  { slug: "royal-bites", name: "Royal Bites", owner: "Rahul Mehta", email: "owner@royalbites.demo", type: "Family restaurant", addr: "Civil Lines, New Delhi", phone: "9876500005", about: "", menu: "family", tables: 0, state: "pending", app: "submitted", fee: "not_assigned" },
  { slug: "tandoori-house", name: "Tandoori House", owner: "Imran Khan", email: "owner@tandoori.demo", type: "Family restaurant", addr: "Sector 17, Chandigarh", phone: "9876500006", about: "", menu: "family", tables: 0, state: "pending", app: "submitted", fee: "not_assigned" },
  { slug: "pizza-palace", name: "Pizza Palace", owner: "Sara Dsouza", email: "owner@pizzapalace.demo", type: "Fast food", addr: "Bandra West, Mumbai", phone: "9876500007", about: "", menu: "fast", tables: 0, state: "pending", app: "approved", fee: "awaiting", feeAmt: 4000 },
];

async function main() {
  if (!(await db.prepare("SELECT 1 FROM restaurants WHERE slug='the-green-fork'").get())) await base(); else console.log("Base demo data already present.");
  await extras();
}

/** Extra demo accounts covering every onboarding state. Safe to re-run. */
async function extras() {
  const exists = async (email: string) => !!(await db.prepare("SELECT 1 FROM users WHERE email=?").get(email));
  let added = 0;
  // second staff admin on an existing restaurant (multiple admins per restaurant)
  if (!(await exists("staff@greenfork.demo"))) {
    const r = (await db.prepare("SELECT id FROM restaurants WHERE slug='the-green-fork'").get()) as { id: number };
    await db.prepare("INSERT INTO users(email,name,password_hash,role,restaurant_id,email_verified) VALUES(?,?,?,'restaurant_admin',?,1)").run("staff@greenfork.demo", "Kavita (Staff)", hash, r.id); added++;
  }
  // applicants in different states
  const applicants: { email: string; owner: string; name: string; slug: string; type: string; addr: string; phone: string; app: "rejected" | "returned" | "draft"; reason?: string; verified: number }[] = [
    { email: "owner@saffron.demo", owner: "Deepak Rathi", name: "Saffron Street", slug: "saffron-street", type: "Fast food", addr: "Sector 29, Gurugram", phone: "9876500008", app: "rejected", reason: "We could not verify the contact number. Please apply again with a working number.", verified: 1 },
    { email: "owner@cloudkitchen.demo", owner: "Isha Kapoor", name: "Cloud Kitchen Co", slug: "cloud-kitchen-co", type: "Other", addr: "HSR Layout, Bengaluru", phone: "9876500009", app: "returned", reason: "Please add a landmark to your address and a short description.", verified: 1 },
    { email: "owner@newbistro.demo", owner: "Manish Arora", name: "New Bistro", slug: "new-bistro", type: "Cafe", addr: "Jubilee Hills, Hyderabad", phone: "9876500010", app: "draft", verified: 0 },
  ];
  for (const a of applicants) {
    if (await exists(a.email)) continue;
    const u = await db.prepare("INSERT INTO users(email,name,password_hash,role,email_verified) VALUES(?,?,?,'restaurant_admin',?)").run(a.email, a.owner, hash, a.verified);
    const r = await db.prepare("INSERT INTO restaurants(slug,name,owner_name,email,address,phone,phone_norm,type,description) VALUES(?,?,?,?,?,?,?,?,'')").run(a.slug, a.name, a.owner, a.email, a.addr, a.phone, a.phone.slice(-10), a.type);
    await db.prepare("UPDATE users SET restaurant_id=? WHERE id=?").run(r.lastInsertRowid, u.lastInsertRowid);
    await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state,reason) VALUES(?,?,?,?)").run(r.lastInsertRowid, u.lastInsertRowid, a.app, a.reason ?? null);
    await db.prepare("INSERT INTO setup_fees(restaurant_id) VALUES(?)").run(r.lastInsertRowid); added++;
  }
  // more customers
  for (const [n, e] of [["Sneha Iyer", "sneha@demo.com"], ["Arjun Mehta", "arjun@demo.com"], ["Fatima Sheikh", "fatima@demo.com"]])
    if (!(await exists(e))) { await db.prepare("INSERT INTO users(email,name,password_hash,role,email_verified) VALUES(?,?,?,'customer',1)").run(e, n, hash); added++; }
  console.log(`Extra demo accounts added: ${added}`);
}

async function base() {
  const ids: Record<string, number> = {};
  for (const r of RESTS) {
    const u = await db.prepare("INSERT INTO users(email,name,password_hash,role,email_verified) VALUES(?,?,?,'restaurant_admin',1)").run(r.email, r.owner, hash);
    let upi: string | null = null;
    if (r.full) upi = await save(await QRCode.toBuffer(`upi://pay?pa=${r.slug.replace(/-/g, "")}@upi&pn=${encodeURIComponent(r.name)}`, { width: 360, margin: 2 }));
    const rr = await db.prepare("INSERT INTO restaurants(slug,name,owner_name,email,address,phone,phone_norm,type,description,upi_qr,state,details_reviewed,inactive_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?)")
      .run(r.slug, r.name, r.owner, r.email, r.addr, r.phone, r.phone.slice(-10), r.type, r.about, upi, r.state, r.state === "inactive" ? "Temporarily closed for renovation" : null);
    const rid = rr.lastInsertRowid; ids[r.slug] = rid;
    await db.prepare("UPDATE users SET restaurant_id=? WHERE id=?").run(rid, u.lastInsertRowid);
    await db.prepare("INSERT INTO applications(restaurant_id,admin_user_id,state) VALUES(?,?,?)").run(rid, u.lastInsertRowid, r.app);
    await db.prepare("INSERT INTO setup_fees(restaurant_id,amount_paise,state,confirmed_at) VALUES(?,?,?,?)").run(rid, r.feeAmt ? r.feeAmt * 100 : null, r.fee, r.fee === "confirmed" ? new Date() : null);
    if (r.full) {
      let pos = 0;
      for (const [cat, items] of Object.entries(MENUS[r.menu])) {
        const c = await db.prepare("INSERT INTO categories(restaurant_id,name,position) VALUES(?,?,?)").run(rid, cat, ++pos);
        for (const it of items) {
          const i = await db.prepare("INSERT INTO items(restaurant_id,category_id,name,description,image,veg) VALUES(?,?,?,?,?,?)").run(rid, c.lastInsertRowid, it.n, it.d, await save(png(it.c)), it.v);
          for (const [label, price] of it.p) await db.prepare("INSERT INTO portions(item_id,label,price_paise) VALUES(?,?,?)").run(i.lastInsertRowid, label, price * 100);
        }
      }
      for (let t = 1; t <= r.tables; t++) await db.prepare("INSERT INTO tables_(restaurant_id,name) VALUES(?,?)").run(rid, String(t));
    }
  }

  // customers
  const custs: number[] = [];
  for (const [n, e] of [["Rohan Gupta", "rohan@demo.com"], ["Meera Nair", "meera@demo.com"], ["Karan Malhotra", "karan@demo.com"], ["Ayesha Khan", "ayesha@demo.com"], ["Vikram Joshi", "vikram@demo.com"]])
    custs.push((await db.prepare("INSERT INTO users(email,name,password_hash,role,email_verified) VALUES(?,?,?,'customer',1)").run(e, n, hash)).lastInsertRowid);

  // orders
  type O = { r: string; c: number; table: string; method: "upi" | "cash"; pick: [string, number][]; status?: "completed" | "cancelled"; paid?: boolean; claimed?: boolean; prep?: number; cancel?: "requested" | "approved" | "rejected"; ago: number };
  const orders: O[] = [
    { r: "the-green-fork", c: 0, table: "5", method: "upi", pick: [["Paneer Butter Masala", 1], ["Butter Naan", 2]], claimed: true, prep: 20, ago: 10 },
    { r: "the-green-fork", c: 1, table: "3", method: "cash", pick: [["Veg Biryani", 1], ["Sweet Lassi", 1]], prep: 15, ago: 25 },
    { r: "the-green-fork", c: 2, table: "2", method: "upi", pick: [["Dal Makhani", 1], ["Garlic Roti", 3]], cancel: "requested", ago: 35 },
    { r: "the-green-fork", c: 3, table: "1", method: "cash", pick: [["Paneer Tikka", 1]], status: "completed", paid: true, ago: 90 },
    { r: "the-green-fork", c: 0, table: "4", method: "upi", pick: [["Hara Bhara Kebab", 2], ["Masala Chai", 2]], status: "completed", paid: true, ago: 150 },
    { r: "the-green-fork", c: 4, table: "6", method: "cash", pick: [["Veg Biryani", 2]], status: "completed", ago: 200 },
    { r: "the-green-fork", c: 1, table: "2", method: "upi", pick: [["Crispy Corn", 1]], status: "cancelled", paid: true, cancel: "approved", ago: 300 },
    { r: "spice-garden", c: 0, table: "4", method: "upi", pick: [["Butter Chicken", 1], ["Palak Paneer", 1]], prep: 25, ago: 8 },
    { r: "spice-garden", c: 2, table: "7", method: "cash", pick: [["Chicken Biryani", 2]], prep: 30, ago: 18 },
    { r: "spice-garden", c: 3, table: "1", method: "upi", pick: [["Mutton Rogan Josh", 1], ["Gulab Jamun (2 pcs)", 2]], status: "completed", paid: true, ago: 120 },
    { r: "lakeview-dine", c: 1, table: "3", method: "upi", pick: [["Classic Margherita Pizza", 1], ["Cappuccino", 2]], prep: 20, ago: 12 },
    { r: "lakeview-dine", c: 4, table: "1", method: "cash", pick: [["Creamy Alfredo Pasta", 1]], status: "completed", paid: true, ago: 60 },
  ];
  for (const o of orders) {
    const rid = ids[o.r];
    const tb = (await db.prepare("SELECT id,name FROM tables_ WHERE restaurant_id=? AND name=?").get(rid, o.table)) as { id: number; name: string };
    const lines: { name: string; label: string; price: number; qty: number }[] = [];
    for (const [nm, qty] of o.pick) {
      const p = (await db.prepare("SELECT i.name, p.label, p.price_paise FROM items i JOIN portions p ON p.item_id=i.id WHERE i.restaurant_id=? AND i.name=? ORDER BY p.id LIMIT 1").get(rid, nm)) as { name: string; label: string; price_paise: number };
      lines.push({ name: p.name, label: p.label, price: p.price_paise, qty });
    }
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    await db.prepare("UPDATE restaurants SET order_seq=order_seq+1 WHERE id=?").run(rid);
    const num = ((await db.prepare("SELECT order_seq s FROM restaurants WHERE id=?").get(rid)) as { s: number }).s + 1000;
    const when = new Date(Date.now() - o.ago * 60_000);
    const oid = (await db.prepare("INSERT INTO orders(restaurant_id,customer_id,number,table_id,table_name,payment_method,payment_status,claimed_paid,status,prep_minutes,total_paise,idem_key,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(rid, custs[o.c], num, tb.id, tb.name, o.method, o.paid ? "paid" : "pending", o.claimed ? 1 : 0, o.status ?? "pending", o.prep ?? null, total, crypto.randomUUID(), crypto.randomBytes(12).toString("hex"), when, when)).lastInsertRowid;
    for (const l of lines) await db.prepare("INSERT INTO order_lines(order_id,item_name,portion_name,qty,unit_paise,line_paise) VALUES(?,?,?,?,?,?)").run(oid, l.name, l.label, l.qty, l.price, l.price * l.qty);
    if (o.cancel) await db.prepare("INSERT INTO cancel_requests(order_id,reason,status) VALUES(?,?,?)").run(oid, "Ordered by mistake", o.cancel);
  }
  console.log(`Seeded ${RESTS.length} restaurants, ${custs.length} customers, ${orders.length} orders.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
