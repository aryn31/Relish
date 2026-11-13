import { db, inr } from "@/lib/db";
import type { Restaurant } from "@/lib/restaurant";
import MenuClient from "./MenuClient";

export type MenuData = { cats: { id: number; name: string; items: { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; portions: { id: number; label: string; price: number; available: number }[] }[] }[] };

export function loadMenu(rid: number): MenuData {
  const cats = db.prepare("SELECT id,name FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid) as { id: number; name: string }[];
  return { cats: cats.map((c) => ({ ...c, items: (db.prepare("SELECT id,name,description,image,veg,available FROM items WHERE category_id=? AND deleted=0 ORDER BY id").all(c.id) as any[])
    .map((i) => ({ ...i, portions: (db.prepare("SELECT id,label,price_paise price,available FROM portions WHERE item_id=? ORDER BY id").all(i.id) as any[]) })) })).filter((c) => c.items.length) };
}

export default function MenuView({ r, preview, labels, open }: { r: Restaurant; preview?: boolean; labels: Record<string, string>; open: boolean }) {
  const menu = loadMenu(r.id);
  return (
    <main>
      <h1 style={{ marginBottom: 0 }}>{r.name}</h1>
      <div className="muted">{r.type} · {r.address} · {r.phone}</div>
      {r.description && <p>{r.description}</p>}
      {preview && <div className="msg">PREVIEW — this is how your page will look. It is private and cannot take orders.</div>}
      {!open && !preview && <div className="msg err">{labels.closed_cart}</div>}
      <MenuClient restaurantId={r.id} slug={r.slug} name={r.name} menu={menu} labels={labels} disabled={preview || !open} />
    </main>
  );
}
export { inr };
