import { db } from "./db";

export type MenuData = { cats: { id: number; name: string; items: { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; portions: { id: number; label: string; price: number; available: number }[] }[] }[] };
type P = { id: number; label: string; price: number; available: number; item_id: number };
type I = { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; category_id: number };

/** Menu grouped by category (only categories that have items). */
export async function menuFor(rid: number): Promise<MenuData> {
  const cats = (await db.prepare("SELECT id,name FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid)) as { id: number; name: string }[];
  const items = (await db.prepare("SELECT id,name,description,image,veg,available,category_id FROM items WHERE restaurant_id=? AND deleted=0 ORDER BY id").all(rid)) as I[];
  const ports = (await db.prepare("SELECT p.id,p.label,p.price_paise price,p.available,p.item_id FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=? AND i.deleted=0 ORDER BY p.id").all(rid)) as P[];
  return { cats: cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id).map(({ category_id, ...i }) => ({ ...i, portions: ports.filter((p) => p.item_id === i.id).map(({ item_id, ...p }) => p) })) })).filter((c) => c.items.length) };
}
/** First photo of the restaurant, used as its cover. */
export async function coverFor(rid: number): Promise<string | null> {
  return ((await db.prepare("SELECT image FROM items WHERE restaurant_id=? AND deleted=0 AND image IS NOT NULL ORDER BY id LIMIT 1").get(rid)) as { image: string } | undefined)?.image ?? null;
}
/** Restaurant fields safe to show publicly (no UPI QR file name, no internal flags). */
export const publicRestaurant = (r: { id: number; slug: string; name: string; type: string; address: string; phone: string; description: string; state: string }) =>
  ({ id: r.id, slug: r.slug, name: r.name, type: r.type, address: r.address, phone: r.phone, description: r.description, state: r.state });
