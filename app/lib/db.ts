import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const g = globalThis as unknown as { _db?: Database.Database };

function init(): Database.Database {
  const db = new Database(path.join(process.cwd(), "data", "app.db"));
  db.pragma("busy_timeout = 15000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT,
    role TEXT NOT NULL CHECK(role IN ('customer','restaurant_admin','super_admin')),
    restaurant_id INTEGER, email_verified INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
    lang TEXT, google_id TEXT, session_version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS restaurants(
    id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, owner_name TEXT NOT NULL, email TEXT NOT NULL,
    address TEXT NOT NULL, phone TEXT NOT NULL, phone_norm TEXT NOT NULL, type TEXT NOT NULL, description TEXT DEFAULT '',
    fssai TEXT, gstin TEXT, upi_qr TEXT, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','inactive')),
    inactive_reason TEXT, details_reviewed INTEGER NOT NULL DEFAULT 0, order_seq INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS applications(
    id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), admin_user_id INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','rejected')), reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS setup_fees(restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id),
    amount_paise INTEGER, prev_amount_paise INTEGER, state TEXT NOT NULL DEFAULT 'not_assigned', confirmed_at TEXT);
  CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    category_id INTEGER NOT NULL REFERENCES categories(id), name TEXT NOT NULL, description TEXT DEFAULT '', image TEXT,
    veg INTEGER, available INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS portions(id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id),
    label TEXT NOT NULL DEFAULT '', price_paise INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS tables_(id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(restaurant_id,name));
  CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
    customer_id INTEGER NOT NULL REFERENCES users(id), number INTEGER NOT NULL, table_id INTEGER NOT NULL, table_name TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('upi','cash')), payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')),
    claimed_paid INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
    prep_minutes INTEGER, total_paise INTEGER NOT NULL, idem_key TEXT UNIQUE NOT NULL, public_id TEXT UNIQUE NOT NULL,
    paid_by INTEGER, paid_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(restaurant_id, number));
  CREATE TABLE IF NOT EXISTS order_lines(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
    item_name TEXT NOT NULL, portion_name TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL, unit_paise INTEGER NOT NULL, line_paise INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cancel_requests(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
    reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')), decided_at TEXT);
  CREATE TABLE IF NOT EXISTS table_moves(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, from_table TEXT, to_table TEXT, by_user INTEGER, at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS oplog(id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, detail TEXT, at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS emails(id INTEGER PRIMARY KEY, to_addr TEXT, subject TEXT, body TEXT, at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS rate(key TEXT, at INTEGER);
  CREATE INDEX IF NOT EXISTS idx_orders_r ON orders(restaurant_id, status, created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_c ON orders(customer_id);
  CREATE UNIQUE INDEX IF NOT EXISTS one_open_cancel ON cancel_requests(order_id) WHERE status='requested';
  `);
  const email = (process.env.SUPER_ADMIN_EMAIL || "super@example.com").toLowerCase();
  if (!db.prepare("SELECT 1 FROM users WHERE role='super_admin'").get()) {
    db.prepare("INSERT OR IGNORE INTO users(email,name,password_hash,role,email_verified) VALUES(?,?,?,?,1)")
      .run(email, "Super Admin", bcrypt.hashSync(process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!", 10), "super_admin");
  }
  return db;
}

export const db = g._db ?? (g._db = init());

export const inr = (paise: number) => {
  const s = (paise / 100).toFixed(2);
  const [i, d] = s.split(".");
  const last3 = i.slice(-3), rest = i.slice(0, -3);
  return "₹" + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3 + "." + d;
};

export function log(actor: number | null, action: string, detail = "") {
  db.prepare("INSERT INTO oplog(actor_id,action,detail) VALUES(?,?,?)").run(actor, action, detail);
}

export function setting(key: string, def: number): number {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get(key) as { value: string } | undefined;
  return r ? Number(r.value) : def;
}

/** Simple DB-backed rate limiter: max `n` hits per `windowSec` for `key`. Returns true if allowed. */
export function rateOk(key: string, n: number, windowSec: number): boolean {
  const now = Date.now();
  db.prepare("DELETE FROM rate WHERE at < ?").run(now - 3600_000);
  const c = (db.prepare("SELECT COUNT(*) c FROM rate WHERE key=? AND at>?").get(key, now - windowSec * 1000) as { c: number }).c;
  if (c >= n) return false;
  db.prepare("INSERT INTO rate VALUES(?,?)").run(key, now);
  return true;
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
