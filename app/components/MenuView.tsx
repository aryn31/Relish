import { db } from "@/lib/db";
import type { Restaurant } from "@/lib/restaurant";
import MenuClient from "./MenuClient";
import Icon from "./Icon";
import { tr } from "@/lib/i18n";

type P = { id: number; label: string; price: number; available: number; item_id: number };
type I = { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; category_id: number };
export type MenuData = { cats: { id: number; name: string; items: { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; portions: { id: number; label: string; price: number; available: number }[] }[] }[] };

export async function loadMenu(rid: number): Promise<MenuData> {
  const cats = (await db.prepare("SELECT id,name FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid)) as { id: number; name: string }[];
  const items = (await db.prepare("SELECT id,name,description,image,veg,available,category_id FROM items WHERE restaurant_id=? AND deleted=0 ORDER BY id").all(rid)) as I[];
  const ports = (await db.prepare("SELECT p.id,p.label,p.price_paise price,p.available,p.item_id FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=? AND i.deleted=0 ORDER BY p.id").all(rid)) as P[];
  return { cats: cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id).map((i) => ({ ...i, portions: ports.filter((p) => p.item_id === i.id) })) })).filter((c) => c.items.length) };
}

export default async function MenuView({ r, preview, labels, open }: { r: Restaurant; preview?: boolean; labels: Record<string, string>; open: boolean }) {
  const menu = await loadMenu(r.id); const { _ } = await tr();
  const cover = ((await db.prepare("SELECT image FROM items WHERE restaurant_id=? AND deleted=0 AND image IS NOT NULL ORDER BY id LIMIT 1").get(r.id)) as { image: string } | undefined)?.image;
  return (
    <main>
      <div className="mhero">{cover && <img src={`/api/img/${cover}`} alt="" />}
        <div className="in"><span className="badge">{_(r.type)}</span><h1>{r.name}</h1>
          <div className="meta"><span><Icon name="pin" size={15} />{r.address}</span><span><Icon name="phone" size={15} />{r.phone}</span></div>
          {r.description && <p style={{ margin: "10px 0 0", maxWidth: 620, opacity: .9 }}>{r.description}</p>}</div></div>
      {preview && <div className="msg">{_("PREVIEW — this is how your page will look. It is private and cannot take orders.")}</div>}
      {!open && !preview && <div className="msg err">{labels.closed_cart}</div>}
      <MenuClient restaurantId={r.id} slug={r.slug} name={r.name} menu={menu} labels={labels} disabled={preview || !open} />
    </main>
  );
}
