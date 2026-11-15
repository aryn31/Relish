import { Pool, PoolClient, types } from "pg";
import { AsyncLocalStorage } from "async_hooks";
import bcrypt from "bcryptjs";

// bigint (COUNT) and numeric (SUM) come back as numbers, not strings.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const g = globalThis as unknown as { _pool?: Pool; _ready?: Promise<void> };
const pool = g._pool ?? (g._pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://relish:relish@localhost:5433/relish",
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  // Most hosted Postgres (Render, Neon, Supabase, RDS) needs TLS from outside their network.
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
}));
const als = new AsyncLocalStorage<PoolClient>();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('customer','restaurant_admin','super_admin')),
  restaurant_id INTEGER, email_verified INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
  lang TEXT, google_id TEXT, session_version INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS restaurants(
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, owner_name TEXT NOT NULL, email TEXT NOT NULL,
  address TEXT NOT NULL, phone TEXT NOT NULL, phone_norm TEXT NOT NULL, type TEXT NOT NULL, description TEXT DEFAULT '',
  fssai TEXT, gstin TEXT, upi_qr TEXT, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','inactive')),
  inactive_reason TEXT, details_reviewed INTEGER NOT NULL DEFAULT 0, order_seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS applications(
  id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), admin_user_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','rejected')), reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS setup_fees(restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id),
  amount_paise INTEGER, prev_amount_paise INTEGER, state TEXT NOT NULL DEFAULT 'not_assigned', confirmed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS categories(id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS items(id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  category_id INTEGER NOT NULL REFERENCES categories(id), name TEXT NOT NULL, description TEXT DEFAULT '', image TEXT,
  veg INTEGER, available INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS portions(id SERIAL PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id),
  label TEXT NOT NULL DEFAULT '', price_paise INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS tables_(id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(restaurant_id,name));
CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  customer_id INTEGER NOT NULL REFERENCES users(id), number INTEGER NOT NULL, table_id INTEGER NOT NULL, table_name TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('upi','cash')), payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')),
  claimed_paid INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
  prep_minutes INTEGER, total_paise INTEGER NOT NULL, idem_key TEXT UNIQUE NOT NULL, public_id TEXT UNIQUE NOT NULL,
  paid_by INTEGER, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, number));
CREATE TABLE IF NOT EXISTS order_lines(id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
  item_name TEXT NOT NULL, portion_name TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL, unit_paise INTEGER NOT NULL, line_paise INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cancel_requests(id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS table_moves(id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, from_table TEXT, to_table TEXT, by_user INTEGER, ts TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS oplog(id SERIAL PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, detail TEXT, ts TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS emails(id SERIAL PRIMARY KEY, to_addr TEXT, subject TEXT, body TEXT, ts TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS files(name TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate(key TEXT, ts BIGINT);
CREATE INDEX IF NOT EXISTS idx_orders_r ON orders(restaurant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_c ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_rate ON rate(key, ts);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_cancel ON cancel_requests(order_id) WHERE status='requested';
`;
const ID_TABLES = new Set(["users", "restaurants", "applications", "categories", "items", "portions", "tables_", "orders", "order_lines", "cancel_requests", "table_moves", "oplog", "emails"]);

async function init() {
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(727001)"); // several workers may start at once
    await c.query(SCHEMA);
    const email = (process.env.SUPER_ADMIN_EMAIL || "super@example.com").toLowerCase();
    const has = await c.query("SELECT 1 FROM users WHERE role='super_admin'");
    if (!has.rowCount) {
      await c.query("INSERT INTO users(email,name,password_hash,role,email_verified) VALUES($1,'Super Admin',$2,'super_admin',1) ON CONFLICT DO NOTHING",
        [email, bcrypt.hashSync(process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!", 10)]);
    }
  } finally { await c.query("SELECT pg_advisory_unlock(727001)").catch(() => {}); c.release(); }
}
const ready = () => (g._ready ??= init().catch((e) => { g._ready = undefined; throw e; }));
const ensure = () => (als.getStore() ? Promise.resolve() : ready());

/** `?` becomes `$n`; sqlite date helpers become Postgres; INSERTs on id tables return the new id. */
function translate(sql: string): { text: string; insertTable?: string } {
  let n = 0;
  let text = sql.replace(/datetime\('now',\s*\?\)/g, "(now() + ?::interval)").replace(/datetime\('now'\)/g, "now()").replace(/\?/g, () => `$${++n}`);
  const m = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(text);
  if (m && ID_TABLES.has(m[1]) && !/RETURNING/i.test(text)) { text += " RETURNING id"; return { text, insertTable: m[1] }; }
  return { text };
}
const runner = () => als.getStore() ?? pool;

export const db = {
  prepare(sql: string) {
    const { text, insertTable } = translate(sql);
    const exec = async (args: unknown[]) => { await ensure(); return runner().query(text, args); };
    return {
      get: async (...a: unknown[]) => (await exec(a)).rows[0] as unknown,
      all: async (...a: unknown[]) => (await exec(a)).rows as unknown[],
      run: async (...a: unknown[]) => { const r = await exec(a); return { changes: r.rowCount ?? 0, lastInsertRowid: insertTable ? (r.rows[0]?.id as number) : 0 }; },
    };
  },
  /** Runs `fn` in a transaction; every db call inside it uses the same connection. */
  transaction<T>(fn: () => Promise<T>) {
    return async (): Promise<T> => {
      if (als.getStore()) return fn(); // already inside one
      await ready();
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await als.run(c, fn);
        await c.query("COMMIT");
        return out;
      } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
      finally { c.release(); }
    };
  },
};
export { pool };


export async function log(actor: number | null, action: string, detail = "") {
  await db.prepare("INSERT INTO oplog(actor_id,action,detail) VALUES(?,?,?)").run(actor, action, detail);
}

export async function setting(key: string, def: number): Promise<number> {
  const r = (await db.prepare("SELECT value FROM settings WHERE key=?").get(key)) as { value: string } | undefined;
  return r ? Number(r.value) : def;
}

/** DB-backed rate limiter: max `n` hits per `windowSec` for `key`. Returns true if allowed. */
export async function rateOk(key: string, n: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  await db.prepare("DELETE FROM rate WHERE ts < ?").run(now - 3600_000);
  const c = ((await db.prepare("SELECT COUNT(*) c FROM rate WHERE key=? AND ts>?").get(key, now - windowSec * 1000)) as { c: number }).c;
  if (c >= n) return false;
  await db.prepare("INSERT INTO rate VALUES(?,?)").run(key, now);
  return true;
}

