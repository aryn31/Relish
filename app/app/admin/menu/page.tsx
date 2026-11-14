import { requireRestAdmin } from "@/lib/auth";
import { db, inr } from "@/lib/db";
import { addCategory, renameCategory, moveCategory, deleteCategory, saveItem, toggleItem, deleteItem } from "@/app/actions/admin";
import PageHead from "@/components/PageHead";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";
import { tr } from "@/lib/i18n";

type Item = { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; category_id: number };
type Portion = { id: number; label: string; price_paise: number; available: number };

type TF = (s: string, vars?: Record<string, string | number>) => string;
function ItemForm({ item, portions, cats, _ }: { item?: Item; portions: Portion[]; cats: { id: number; name: string }[]; _: TF }) {
  const rows = [...portions, ...Array.from({ length: Math.max(2, 4 - portions.length) }, () => null)];
  return (
    <form action={saveItem} className="stack">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="row"><div className="grow"><label>{_("Name")}</label><input name="name" defaultValue={item?.name} required /></div>
        <div className="grow"><label>{_("Category")}</label><select name="category_id" defaultValue={item?.category_id}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
      <label>{_("Description (optional)")}</label><input name="description" defaultValue={item?.description} />
      <div className="row"><div><label>{_("Veg / non-veg")}</label><select name="veg" defaultValue={item?.veg == null ? "" : String(item.veg)}><option value="">{_("Not set")}</option><option value="1">{_("Vegetarian")}</option><option value="0">{_("Non-vegetarian")}</option></select></div>
        <div className="grow"><label>{_("Image (JPEG, PNG or WebP, up to 5 MB)")}</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></div></div>
      <div><strong>{_("Prices (₹)")}</strong> <span className="muted">{_("One row with no label = one fixed price. For several portions give each a label (e.g. Half, Full).")}</span>
        {rows.map((p, i) => (
          <div className="row" key={i} style={{ marginTop: 6 }}>
            <input className="grow" name="plabel" placeholder={_("Label (e.g. Half)")} defaultValue={p?.label} aria-label={_("Portion label")} />
            <input style={{ width: 110 }} name="pprice" type="number" step="0.01" min="0.01" placeholder={_("Price")} defaultValue={p ? (p.price_paise / 100).toFixed(2) : ""} aria-label={_("Price")} />
            <label style={{ margin: 0, fontWeight: 400 }}><input type="checkbox" name="punavail" value={i} defaultChecked={p ? !p.available : false} /> {_("unavailable")}</label>
          </div>))}
      </div>
      <label style={{ fontWeight: 400 }}><input type="checkbox" name="available" defaultChecked={item ? !!item.available : true} /> {_("Available to order")}</label>
      <button>{item ? _("Save item") : _("Add item")}</button>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const { _ } = await tr(); const sp = await searchParams; const u = await requireRestAdmin(); const rid = u.restaurant_id;
  const cats = await db.prepare("SELECT * FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid) as { id: number; name: string }[];
  const items = await db.prepare("SELECT * FROM items WHERE restaurant_id=? AND deleted=0 ORDER BY id").all(rid) as Item[];
  const allPor = (await db.prepare("SELECT p.* FROM portions p JOIN items i ON i.id=p.item_id WHERE i.restaurant_id=? ORDER BY p.id").all(rid)) as (Portion & { item_id: number })[];
  const por = (id: number) => allPor.filter((p) => p.item_id === id);
  const edit = sp.edit ? items.find((i) => i.id === Number(sp.edit)) : undefined;
  return (
    <div><PageHead title="Menu" sub="Categories, items, portions and prices." /><Flash sp={sp} />
      <h2 style={{ marginTop: 0 }}>{_("Categories")}</h2>
      <div className="card">
      <form action={addCategory} className="row"><input className="grow" name="name" placeholder={_("New category, e.g. Starters")} aria-label={_("Category name")} required /><button>{_("Add category")}</button></form>
      {cats.map((c) => (
        <div className="row" key={c.id} style={{ marginTop: 8 }}>
          <form action={renameCategory} className="row grow"><input type="hidden" name="id" value={c.id} /><input className="grow" name="name" defaultValue={c.name} aria-label={_("Category name")} /><button className="alt">{_("Rename")}</button></form>
          <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button className="alt" aria-label={_("Move up")}>↑</button></form>
          <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button className="alt" aria-label={_("Move down")}>↓</button></form>
          <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><Confirm className="alt" message={_("Delete this category?")}>{_("Delete")}</Confirm></form>
        </div>))}
      </div>

      <h2>{_("Items")}</h2>
      {items.length === 0 ? <p className="muted">{_("No items yet.")}</p> :
        <div className="agrid">{items.map((i) => (
          <div className={`card acard ${i.available ? "" : "off"}`} key={i.id}>
            <div className="ph">{i.image && <img src={`/api/img/${i.image}`} alt="" />}</div>
            <div className="b">
              <div className="row" style={{ justifyContent: "space-between" }}><h3>{i.name}</h3><span className={`badge ${i.available ? "active" : "inactive"}`}>{i.available ? _("Available") : _("Off")}</span></div>
              <div className="muted" style={{ fontSize: ".85rem" }}>{cats.find((c) => c.id === i.category_id)?.name}</div>
              <div style={{ fontWeight: 650 }}>{por(i.id).map((p) => `${p.label ? p.label + " " : ""}${inr(p.price_paise)}${p.available ? "" : ` (${_("off")})`}`).join(" · ")}</div>
              <div className="row" style={{ marginTop: "auto", paddingTop: 6 }}>
                <a className="btn alt" href={`/admin/menu?edit=${i.id}#item-form`}>{_("Edit")}</a>
                <form action={toggleItem}><input type="hidden" name="id" value={i.id} /><button className="alt">{i.available ? _("Turn off") : _("Turn on")}</button></form>
                <form action={deleteItem}><input type="hidden" name="id" value={i.id} /><Confirm className="alt" message={_("Delete this item? Past orders keep their record.")}>{_("Delete")}</Confirm></form>
              </div></div></div>))}</div>}
      {cats.length > 0 && <><h2 id="item-form" style={{ scrollMarginTop: 90 }}>{edit ? _("Edit: {name}", { name: edit.name }) : _("Add item")}</h2><div className="card" style={{ maxWidth: 680 }}>
        <ItemForm key={edit?.id ?? "new"} item={edit} portions={edit ? por(edit.id) : []} cats={cats} _={_} /></div></>}

    </div>
  );
}
