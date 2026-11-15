// End-to-end test against a running dev server (localhost:3000) and the seeded Postgres DB.
// Run: node scripts/e2e.mjs   (re-seed first for a clean run)
import fs from "fs";
import pg from "pg";
const BASE = process.env.BASE || "http://localhost:3000";
// Server-action ids come from the frontend build (run against `next dev` after visiting pages, or a `next build`).
const MANIFEST = process.env.MANIFEST || new URL("../../frontend/.next/server/server-reference-manifest.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).node;
const ID = Object.fromEntries(Object.entries(manifest).map(([k, v]) => [v.exportedName, k]));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://relish:relish@localhost:5433/relish" });
const q = async (sql, a = []) => (await db.query(sql, a)).rows;

let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { c ? pass++ : fail++; console.log(`${c ? "  ✓" : "  ✗ FAIL"} ${name}${!c && extra ? "  → " + extra : ""}`); };

class Client {
  jar = {};
  async req(path, init = {}) {
    const r = await fetch(BASE + path, { redirect: "manual", ...init, headers: { cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "), ...(init.headers || {}) } });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    return r;
  }
  /** Form-style server action. Returns { loc, msg, err } from the redirect. */
  async form(action, fields = {}, files = {}, at = "/") {
    const fd = new FormData(); fd.append(`$ACTION_ID_${ID[action]}`, "");
    for (const [k, v] of Object.entries(fields)) Array.isArray(v) ? v.forEach((x) => fd.append(k, String(x))) : fd.append(k, String(v));
    for (const [k, v] of Object.entries(files)) fd.append(k, v);
    const r = await this.req(at, { method: "POST", body: fd });
    const loc = r.headers.get("location") || (r.headers.get("x-action-redirect") || "").split(";")[0]; const u = new URL(loc || "http://x/", BASE);
    return { status: r.status, loc, msg: u.searchParams.get("ok") || u.searchParams.get("err") || "", err: u.searchParams.has("err") };
  }
  /** RPC-style server action (client component calls). */
  async rpc(action, args, at = "/") {
    const r = await this.req(at, { method: "POST", headers: { "next-action": ID[action], "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" }, body: JSON.stringify(args) });
    const t = await r.text(); const line = t.split("\n").find((l) => l.startsWith("1:"));
    return line ? JSON.parse(line.slice(2)) : t;
  }
  async login(email, password = "Demo@1234") { const r = await this.form("login", { email, password, next: "/" }, {}, "/login"); return r; }
  async page(path) { return (await this.req(path)).text(); }
}

const png = () => new File([Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082", "hex")], "q.png", { type: "image/png" });
const uuid = () => crypto.randomUUID();
const green = (await q("SELECT id FROM restaurants WHERE slug='the-green-fork'"))[0].id;
const portion = async (rid, name) => (await q("SELECT p.id, p.price_paise price FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=$1 AND i.name=$2 ORDER BY p.id LIMIT 1", [rid, name]))[0];
const tableId = async (rid, name) => (await q("SELECT id FROM tables_ WHERE restaurant_id=$1 AND name=$2", [rid, name]))[0].id;

console.log("\n== Customer ordering ==");
const rohan = new Client(), meera = new Client();
ok((await rohan.login("rohan@demo.com")).loc === "/", "customer can sign in");
ok((await new Client().login("rohan@demo.com", "wrong")).err, "wrong password rejected");
const chai = await portion(green, "Masala Chai"), kebab = await portion(green, "Hara Bhara Kebab");
const chk = await rohan.rpc("checkCart", [green, [{ portionId: chai.id, qty: 2 }]], "/r/the-green-fork/checkout");
ok(chk.open && chk.total === chai.price * 2 && chk.tables.length === 6, "checkCart returns server prices, total and active tables");

const base = async (extra = {}) => ({ restaurantId: green, tableId: await tableId(green, "1"), method: "cash", idem: uuid(), lines: [{ portionId: chai.id, qty: 2, expectedPrice: chai.price }], ...extra });
const anon = await new Client().rpc("placeOrder", [await base()], "/r/the-green-fork/checkout");
ok(anon.error?.includes("sign in"), "anonymous cannot place order");
ok((await rohan.rpc("placeOrder", [await base({ lines: [{ portionId: chai.id, qty: 2, expectedPrice: 1 }] })])).error?.includes("Prices"), "tampered/stale price rejected");
ok((await rohan.rpc("placeOrder", [await base({ tableId: 999999 })])).error?.includes("table"), "invalid table rejected");
const urban = (await q("SELECT id FROM restaurants WHERE slug='urban-bites'"))[0].id;
ok((await rohan.rpc("placeOrder", [{ restaurantId: urban, tableId: await tableId(urban, "1"), method: "cash", idem: uuid(), lines: [{ portionId: (await portion(urban, "French Fries")).id, qty: 1, expectedPrice: 9000 }] }])).error?.includes("unavailable"), "inactive restaurant cannot take orders");

const before = (await q("SELECT COUNT(*)::int c FROM orders WHERE restaurant_id=$1", [green]))[0].c;
const same = await base({ idem: uuid() });
const [a, b, c] = await Promise.all([rohan.rpc("placeOrder", [same]), rohan.rpc("placeOrder", [same]), rohan.rpc("placeOrder", [same])]);
const after = (await q("SELECT COUNT(*)::int c FROM orders WHERE restaurant_id=$1", [green]))[0].c;
ok(a.publicId && a.publicId === b.publicId && b.publicId === c.publicId, "3 simultaneous submits return the same order");
ok(after === before + 1, "exactly one order created for concurrent duplicates", `created ${after - before}`);
const pub = a.publicId; const oid = (await q("SELECT id,number,total_paise FROM orders WHERE public_id=$1", [pub]))[0];
ok(oid.total_paise === chai.price * 2, "server computed total correctly");
const seq = await q("SELECT number FROM orders WHERE restaurant_id=$1 ORDER BY number", [green]);
ok(new Set(seq.map((r) => r.number)).size === seq.length, "order numbers unique per restaurant");

// cap on pending orders (default 5; rohan already has pending ones here)
let capErr = "";
for (let i = 0; i < 8 && !capErr; i++) { const r = await rohan.rpc("placeOrder", [await base({ idem: uuid() })]); if (r.error) capErr = r.error; }
ok(capErr.includes("pending orders"), "max pending orders per restaurant enforced", capErr);

console.log("\n== Customer privacy & payments ==");
await meera.login("meera@demo.com");
ok((await meera.page(`/orders/${pub}`)).includes("Order not found"), "other customer cannot open my order");
ok((await new Client().req(`/api/upi/${pub}`)).status === 403, "UPI QR not served to anonymous");
ok((await meera.req(`/api/upi/${pub}`)).status === 403, "UPI QR not served to other customer");
await rohan.form("switchMethod", { pid: pub, method: "upi" }, {}, `/orders/${pub}`);
ok((await rohan.req(`/api/upi/${pub}`)).status === 200, "own UPI QR is served after order");
await rohan.form("reportPaid", { pid: pub }, {}, `/orders/${pub}`);
let o = (await q("SELECT payment_status, claimed_paid FROM orders WHERE id=$1", [oid.id]))[0];
ok(o.claimed_paid === 1 && o.payment_status === "pending", "'I have paid' records a claim only, never Paid");

console.log("\n== Restaurant admin ==");
const owner = new Client(), other = new Client();
await owner.login("owner@greenfork.demo"); await other.login("owner@spicegarden.demo");
ok(!(await other.form("completeOrder", { id: oid.id, back: "/admin/orders" }, {}, "/admin/orders")).msg.includes("completed"), "other restaurant's admin cannot complete my order");
ok((await q("SELECT status FROM orders WHERE id=$1", [oid.id]))[0].status === "pending", "order untouched by other restaurant");
ok((await owner.form("setPrep", { id: oid.id, minutes: 18, back: "/admin/orders" }, {}, "/admin/orders")).msg.includes("updated"), "admin sets preparation time");
ok((await owner.form("reassignTable", { id: oid.id, table_id: await tableId(green, "4"), back: "/admin/orders" }, {}, "/admin/orders")).msg.includes("Table changed"), "admin reassigns table");
ok((await q("SELECT COUNT(*)::int c FROM table_moves WHERE order_id=$1", [oid.id]))[0].c === 1, "table move recorded");
const p1 = await owner.form("confirmPayment", { id: oid.id, back: "/admin/orders" }, {}, "/admin/orders");
const p2 = await owner.form("confirmPayment", { id: oid.id, back: "/admin/orders" }, {}, "/admin/orders");
ok(p1.msg.includes("marked as paid") && p2.err, "payment confirmed once; duplicate confirmation blocked", p2.msg);
ok((await q("SELECT paid_by FROM orders WHERE id=$1", [oid.id]))[0].paid_by !== null, "who confirmed is recorded");
ok((await rohan.page(`/orders/${pub}`)).includes("Paid"), "customer sees Paid");

console.log("\n== Cancellation ==");
const victim = (await q("SELECT public_id, id FROM orders WHERE restaurant_id=$1 AND status='pending' AND payment_status='pending' AND customer_id=(SELECT id FROM users WHERE email='rohan@demo.com') ORDER BY id DESC LIMIT 1", [green]))[0];
ok((await rohan.form("requestCancel", { pid: victim.public_id, reason: "" }, {}, `/orders/${victim.public_id}`)).err, "cancellation needs a reason");
ok((await rohan.form("requestCancel", { pid: victim.public_id, reason: "Changed my mind" }, {}, `/orders/${victim.public_id}`)).msg.includes("requested"), "customer requests cancellation");
ok((await rohan.form("requestCancel", { pid: victim.public_id, reason: "Again" }, {}, `/orders/${victim.public_id}`)).err, "second request while one is open is blocked");
ok((await q("SELECT status FROM orders WHERE id=$1", [victim.id]))[0].status === "pending", "request alone does not cancel the order");
const d1 = await owner.form("decideCancel", { id: victim.id, decision: "approve", back: "/admin/orders" }, {}, "/admin/orders");
const d2 = await other.form("decideCancel", { id: victim.id, decision: "reject", back: "/admin/orders" }, {}, "/admin/orders");
ok(d1.msg.includes("cancelled") && (await q("SELECT status FROM orders WHERE id=$1", [victim.id]))[0].status === "cancelled", "admin approves → order Cancelled");
ok((await owner.form("confirmPayment", { id: victim.id, back: "/admin/orders" }, {}, "/admin/orders")).err, "cannot confirm payment on cancelled order");
ok((await owner.form("completeOrder", { id: victim.id, back: "/admin/orders" }, {}, "/admin/orders")).err, "cancelled order is final (cannot complete)");

console.log("\n== Complete order (independent of payment) ==");
const pend = (await q("SELECT id FROM orders WHERE restaurant_id=$1 AND status='pending' AND payment_status='pending' ORDER BY id LIMIT 1", [green]))[0];
await owner.form("completeOrder", { id: pend.id, back: "/admin/orders" }, {}, "/admin/orders");
o = (await q("SELECT status, payment_status FROM orders WHERE id=$1", [pend.id]))[0];
ok(o.status === "completed" && o.payment_status === "pending", "completed order can stay payment-pending");

console.log("\n== Restaurant onboarding → live (no setup fee; request goes straight to super admin) ==");
const owner2 = new Client(), sup = new Client();
const email = `e2e${Date.now()}@test.dev`;
const reg = await owner2.form("registerRestaurant", { name: "E2E Kitchen", owner: "Test Owner", type: "Cafe", address: "1 Test Street", phone: "9811122233", email, password: "Passw0rd1" }, {}, "/owner/register");
ok(reg.loc.startsWith("/admin"), "owner registers");
const rid = (await q("SELECT restaurant_id r FROM users WHERE email=$1", [email]))[0].r;
ok((await q("SELECT state FROM restaurants WHERE id=$1", [rid]))[0].state === "pending", "new restaurant is Pending, not live");
ok((await q("SELECT state FROM applications WHERE restaurant_id=$1", [rid]))[0].state === "submitted", "application is submitted to super admin automatically");
ok((await q("SELECT COUNT(*)::int c FROM emails WHERE to_addr='super@example.com' AND body LIKE '%E2E Kitchen%'"))[0].c === 1, "super admin is notified");
ok(!(await new Client().page("/")).includes("E2E Kitchen"), "pending restaurant hidden from directory");
ok((await new Client().page("/r/e2e-kitchen")).includes("currently unavailable"), "pending restaurant URL shows 'unavailable'");
ok((await q("SELECT COUNT(*)::int c FROM emails WHERE to_addr=$1 AND subject='Verify your email'", [email]))[0].c === 0, "no verification email is sent (verification switched off)");
ok(!(await owner2.page("/admin")).includes("Please verify your email"), "owner sees no 'verify your email' banner");
await owner2.form("submitApplication", {}, {}, "/admin"); await owner2.form("submitApplication", {}, {}, "/admin");
ok((await q("SELECT COUNT(*)::int c FROM applications WHERE restaurant_id=$1", [rid]))[0].c === 1, "no duplicate applications created");

await sup.login("super@example.com", "ChangeMe123!");
const app = (await q("SELECT id FROM applications WHERE restaurant_id=$1", [rid]))[0].id;
ok((await owner2.req("/super")).status === 307, "owner cannot open super-admin area");
ok(!(await owner2.page("/admin")).includes("Setup fee"), "owner sees no setup-fee payment step");
ok(!(await sup.page(`/super/apps/${app}`)).includes("Assign fee"), "super admin sees no fee controls");
ok((await sup.form("assignFee", { app_id: app, amount: "5000" }, {}, `/super/apps/${app}`)).err, "fee actions are blocked on the server");
ok((await sup.form("decideApplication", { app_id: app, decision: "return", reason: "" }, {}, `/super/apps/${app}`)).err, "return needs a reason");
await sup.form("decideApplication", { app_id: app, decision: "return", reason: "Add landmark to address" }, {}, `/super/apps/${app}`);
ok((await q("SELECT state, reason FROM applications WHERE id=$1", [app]))[0].state === "returned", "super admin returns for corrections");
await owner2.form("submitApplication", {}, {}, "/admin");
ok((await q("SELECT state FROM applications WHERE id=$1", [app]))[0].state === "submitted", "owner resubmits after corrections");
await sup.form("decideApplication", { app_id: app, decision: "approve", reason: "" }, {}, `/super/apps/${app}`);
ok((await q("SELECT state FROM applications WHERE id=$1", [app]))[0].state === "approved", "super admin approves");
ok((await owner2.form("addCategory", { name: "Coffee" }, {}, "/admin/menu")).msg.includes("added"), "setup checklist unlocks on approval");
const cat = (await q("SELECT id FROM categories WHERE restaurant_id=$1", [rid]))[0].id;
await owner2.form("saveItem", { category_id: cat, name: "Latte", plabel: ["Small", "Large", "", ""], pprice: ["120", "160", "", ""], available: "on" }, {}, "/admin/menu");
ok((await q("SELECT COUNT(*)::int c FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=$1", [rid]))[0].c === 2, "item with two portions saved");
ok((await owner2.form("saveItem", { category_id: cat, name: "Bad", plabel: [""], pprice: ["-5"] }, {}, "/admin/menu")).err, "invalid price rejected");
ok((await owner2.form("uploadUpi", {}, { upi: new File([Buffer.from("not an image")], "x.png", { type: "image/png" }) }, "/admin/payments")).err, "fake image file rejected by content check");
await owner2.form("addTable", { name: "A1" }, {}, "/admin/tables");
ok((await owner2.form("addTable", { name: "A1" }, {}, "/admin/tables")).err, "duplicate table name rejected");
ok((await q("SELECT state FROM restaurants WHERE id=$1", [rid]))[0].state === "pending", "not live until UPI QR is uploaded");
await owner2.form("uploadUpi", {}, { upi: png() }, "/admin/payments");
ok((await q("SELECT state FROM restaurants WHERE id=$1", [rid]))[0].state === "active", "goes live automatically once approved and set up (no fee needed)");
ok((await new Client().page("/")).includes("E2E Kitchen"), "now visible in directory");
ok((await new Client().page("/r/e2e-kitchen")).includes("Latte"), "menu page shows the item");

console.log("\n== Deactivation ==");
const deact = await sup.form("deactivateRestaurant", { id: green, reason: "" }, {}, "/super/restaurants");
ok(deact.err, "deactivation needs a reason");
await sup.form("deactivateRestaurant", { id: green, reason: "Test" }, {}, "/super/restaurants");
ok((await new Client().page("/r/the-green-fork")).includes("currently unavailable"), "inactive restaurant page unavailable");
ok(!(await new Client().page("/")).includes("The Green Fork"), "inactive hidden from directory");
await q("DELETE FROM rate");
ok((await rohan.rpc("placeOrder", [await base({ idem: uuid() })])).error?.includes("unavailable"), "server blocks orders on inactive restaurant (even from an old page)");
const unpaid = (await q("SELECT id FROM orders WHERE restaurant_id=$1 AND payment_status='pending' AND status!='cancelled' LIMIT 1", [green]))[0];
ok((await owner.form("confirmPayment", { id: unpaid.id, back: "/admin/orders" }, {}, "/admin/orders")).err, "payment confirmation blocked while inactive");
ok((await q("SELECT COUNT(*)::int c FROM orders WHERE restaurant_id=$1", [green]))[0].c > 0, "existing orders preserved");
await sup.form("activateRestaurant", { id: green }, {}, "/super/restaurants");
ok((await q("SELECT state FROM restaurants WHERE id=$1", [green]))[0].state === "active", "super admin reactivates");

console.log("\n== Other ==");
ok((await new Client().req("/api/qr/the-green-fork")).status === 403, "menu QR download needs admin login");
ok((await owner.req("/api/qr/the-green-fork")).status === 200, "admin downloads own QR");
ok((await other.req("/api/qr/the-green-fork")).status === 403, "other restaurant's admin cannot download my QR");
ok((await new Client().page("/login")).includes("Sign in"), "login page renders");
console.log(`\n${pass} passed, ${fail} failed`);
await db.end(); process.exit(fail ? 1 : 0);
