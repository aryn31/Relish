import { requireRestAdmin } from "@/lib/auth";
import { db, inr } from "@/lib/db";
import { addCategory, renameCategory, moveCategory, deleteCategory, saveItem, toggleItem, deleteItem } from "@/app/actions/admin";
import Flash from "@/components/Flash";
import Confirm from "@/components/Confirm";

type Item = { id: number; name: string; description: string; image: string | null; veg: number | null; available: number; category_id: number };
type Portion = { id: number; label: string; price_paise: number; available: number };

function ItemForm({ item, portions, cats }: { item?: Item; portions: Portion[]; cats: { id: number; name: string }[] }) {
  const rows = [...portions, ...Array.from({ length: Math.max(2, 4 - portions.length) }, () => null)];
  return (
    <form action={saveItem} className="stack">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="row"><div className="grow"><label>Name</label><input name="name" defaultValue={item?.name} required /></div>
        <div className="grow"><label>Category</label><select name="category_id" defaultValue={item?.category_id}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
      <label>Description (optional)</label><input name="description" defaultValue={item?.description} />
      <div className="row"><div><label>Veg / non-veg</label><select name="veg" defaultValue={item?.veg == null ? "" : String(item.veg)}><option value="">Not set</option><option value="1">Vegetarian</option><option value="0">Non-vegetarian</option></select></div>
        <div className="grow"><label>Image (JPEG, PNG or WebP, up to 5 MB)</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></div></div>
      <div><strong>Prices (₹)</strong> <span className="muted">One row with no label = one fixed price. For several portions give each a label (e.g. Half, Full).</span>
        {rows.map((p, i) => (
          <div className="row" key={i} style={{ marginTop: 6 }}>
            <input className="grow" name="plabel" placeholder="Label (e.g. Half)" defaultValue={p?.label} aria-label="Portion label" />
            <input style={{ width: 110 }} name="pprice" type="number" step="0.01" min="0.01" placeholder="Price" defaultValue={p ? (p.price_paise / 100).toFixed(2) : ""} aria-label="Price" />
            <label style={{ margin: 0, fontWeight: 400 }}><input type="checkbox" name="punavail" value={i} defaultChecked={p ? !p.available : false} /> unavailable</label>
          </div>))}
      </div>
      <label style={{ fontWeight: 400 }}><input type="checkbox" name="available" defaultChecked={item ? !!item.available : true} /> Available to order</label>
      <button>{item ? "Save item" : "Add item"}</button>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const sp = await searchParams; const u = await requireRestAdmin(); const rid = u.restaurant_id;
  const cats = db.prepare("SELECT * FROM categories WHERE restaurant_id=? ORDER BY position,id").all(rid) as { id: number; name: string }[];
  const items = db.prepare("SELECT * FROM items WHERE restaurant_id=? AND deleted=0 ORDER BY id").all(rid) as Item[];
  const por = (id: number) => db.prepare("SELECT * FROM portions WHERE item_id=? ORDER BY id").all(id) as Portion[];
  const edit = sp.edit ? items.find((i) => i.id === Number(sp.edit)) : undefined;
  return (
    <div><Flash sp={sp} />
      <h2 style={{ marginTop: 0 }}>Categories</h2>
      <form action={addCategory} className="row"><input className="grow" name="name" placeholder="New category, e.g. Starters" aria-label="Category name" required /><button>Add category</button></form>
      {cats.map((c) => (
        <div className="row" key={c.id} style={{ marginTop: 8 }}>
          <form action={renameCategory} className="row grow"><input type="hidden" name="id" value={c.id} /><input className="grow" name="name" defaultValue={c.name} aria-label="Category name" /><button className="alt">Rename</button></form>
          <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button className="alt" aria-label="Move up">↑</button></form>
          <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button className="alt" aria-label="Move down">↓</button></form>
          <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><Confirm className="alt" message="Delete this category?">Delete</Confirm></form>
        </div>))}

      {cats.length > 0 && <><h2>{edit ? `Edit: ${edit.name}` : "Add item"}</h2><div className="card" style={{ maxWidth: 640 }}>
        <ItemForm key={edit?.id ?? "new"} item={edit} portions={edit ? por(edit.id) : []} cats={cats} /></div></>}

      <h2>Items</h2>
      {items.length === 0 ? <p className="muted">No items yet.</p> :
        <table className="t"><tbody>{items.map((i) => (
          <tr key={i.id}>
            <td><strong>{i.name}</strong><div className="muted">{cats.find((c) => c.id === i.category_id)?.name} · {por(i.id).map((p) => `${p.label ? p.label + " " : ""}${inr(p.price_paise)}${p.available ? "" : " (off)"}`).join(", ")}</div></td>
            <td><span className="badge">{i.available ? "Available" : "Unavailable"}</span></td>
            <td className="row">
              <a className="btn alt" href={`/admin/menu?edit=${i.id}`}>Edit</a>
              <form action={toggleItem}><input type="hidden" name="id" value={i.id} /><button className="alt">{i.available ? "Mark unavailable" : "Mark available"}</button></form>
              <form action={deleteItem}><input type="hidden" name="id" value={i.id} /><Confirm className="alt" message="Delete this item? Past orders keep their record.">Delete</Confirm></form>
            </td>
          </tr>))}</tbody></table>}
    </div>
  );
}
