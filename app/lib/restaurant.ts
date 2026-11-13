import { db } from "./db";

export type Restaurant = { id: number; slug: string; name: string; owner_name: string; email: string; address: string; phone: string; type: string; description: string; upi_qr: string | null; state: "pending" | "active" | "inactive"; inactive_reason: string | null; details_reviewed: number; fssai: string | null; gstin: string | null };

export const getRestaurant = (id: number) => db.prepare("SELECT * FROM restaurants WHERE id=?").get(id) as Restaurant | undefined;
export const getBySlug = (slug: string) => db.prepare("SELECT * FROM restaurants WHERE slug=?").get(slug) as Restaurant | undefined;

export function application(restaurantId: number) {
  return db.prepare("SELECT * FROM applications WHERE restaurant_id=? ORDER BY id DESC LIMIT 1").get(restaurantId) as { id: number; state: string; reason: string | null } | undefined;
}
export function fee(restaurantId: number) {
  return db.prepare("SELECT * FROM setup_fees WHERE restaurant_id=?").get(restaurantId) as { amount_paise: number | null; state: string; prev_amount_paise: number | null } | undefined;
}

/** Activation conditions (PRD 5.4). Returns checklist; `ok` when all hold. */
export function checklist(r: Restaurant) {
  const app = application(r.id), f = fee(r.id);
  const hasItem = !!db.prepare(`SELECT 1 FROM items i JOIN portions p ON p.item_id=i.id WHERE i.restaurant_id=? AND i.deleted=0 AND i.available=1 AND p.available=1 AND p.price_paise>0 LIMIT 1`).get(r.id);
  const hasCat = !!db.prepare("SELECT 1 FROM categories WHERE restaurant_id=? LIMIT 1").get(r.id);
  const hasTable = !!db.prepare("SELECT 1 FROM tables_ WHERE restaurant_id=? AND active=1 LIMIT 1").get(r.id);
  const steps = [
    { key: "approved", ok: app?.state === "approved" },
    { key: "fee", ok: f?.state === "confirmed" },
    { key: "upi", ok: !!r.upi_qr },
    { key: "menu", ok: hasCat && hasItem },
    { key: "table", ok: hasTable },
    { key: "reviewed", ok: !!r.details_reviewed },
  ];
  return { steps, ok: steps.every((s) => s.ok) };
}

/** Auto-activate a pending restaurant when all conditions hold. Never reactivates Inactive ones automatically. */
export function maybeActivate(id: number) {
  const r = getRestaurant(id);
  if (r && r.state === "pending" && checklist(r).ok) db.prepare("UPDATE restaurants SET state='active' WHERE id=?").run(id);
}

export function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
  let s = base, n = 1;
  while (db.prepare("SELECT 1 FROM restaurants WHERE slug=?").get(s)) s = `${base}-${++n}`;
  return s;
}
export const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);
